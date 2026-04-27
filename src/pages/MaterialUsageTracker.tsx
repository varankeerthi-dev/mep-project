import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { useMaterials } from '../hooks/useMaterials';
import { useVariants } from '../hooks/useVariants';
import { 
  getDailyUsageByDate, 
  getProjectMaterialList,
  logDailyUsage,
  updateDailyUsage,
  deleteDailyUsage 
} from '../material-usage/api';
import { Save, Trash2, Calendar, CheckCircle } from 'lucide-react';

interface ProjectProps {
  projectId: string;
  organisationId: string;
}

export default function MaterialUsageTracker({ projectId, organisationId }: ProjectProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: materials } = useMaterials();
  const { data: variants } = useVariants();

  if (!organisationId) {
    return <div className="p-6 text-center text-red-600">Organisation ID is required</div>;
  }

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(true);
  const [formData, setFormData] = useState({
    item_id: '',
    variant_id: '',
    quantity_used: '',
    unit: '',
    activity: '',
    remarks: ''
  });

  const { data: materialList = [] } = useQuery({
    queryKey: ['projectMaterialList', projectId],
    queryFn: () => getProjectMaterialList(projectId),
    enabled: !!projectId
  });

  const { data: dailyUsage = [], isLoading } = useQuery({
    queryKey: ['dailyUsage', projectId, selectedDate],
    queryFn: () => getDailyUsageByDate(projectId, selectedDate),
    enabled: !!projectId && !!selectedDate
  });

  // Debug logging
  console.log('Daily Usage Debug:', { dailyUsage, isLoading, selectedDate, projectId });

  const logMutation = useMutation({
    mutationFn: (data: any) => logDailyUsage({
      ...data,
      project_id: projectId,
      organisation_id: organisationId,
      usage_date: selectedDate
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyUsage', projectId, selectedDate] });
      setFormData({ item_id: '', variant_id: '', quantity_used: '', unit: '', activity: '', remarks: '' });
      setShowForm(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) => 
      updateDailyUsage(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyUsage', projectId, selectedDate] });
      setEditingId(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDailyUsage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyUsage', projectId, selectedDate] });
    }
  });

  const handleLog = () => {
    if (!formData.item_id || !formData.quantity_used || !formData.unit) {
      alert('Please fill in all required fields');
      return;
    }
    logMutation.mutate({
      item_id: formData.item_id,
      variant_id: formData.variant_id || null,
      quantity_used: parseFloat(formData.quantity_used),
      unit: formData.unit,
      activity: formData.activity || null,
      remarks: formData.remarks || null
    });
  };

  const handleUpdate = (id: string) => {
    if (!formData.quantity_used || !formData.unit) {
      alert('Please fill in all required fields');
      return;
    }
    updateMutation.mutate({
      id,
      updates: {
        quantity_used: parseFloat(formData.quantity_used),
        unit: formData.unit,
        activity: formData.activity || null,
        remarks: formData.remarks || null
      }
    });
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setFormData({
      item_id: item.item_id,
      variant_id: item.variant_id || '',
      quantity_used: item.quantity_used.toString(),
      unit: item.unit,
      activity: item.activity || '',
      remarks: item.remarks || ''
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this usage entry?')) {
      deleteMutation.mutate(id);
    }
  };

  const getMaterialName = (itemId: string) => {
    const material = materialList.find((m: any) => m.item_id === itemId);
    return material?.materials?.display_name || material?.materials?.name || 'Unknown';
  };

  const getVariantName = (variantId: string | null) => {
    if (!variantId) return '';
    const material = materialList.find((m: any) => m.variant_id === variantId);
    return material?.company_variants?.variant_name || '';
  };

  const getUnit = (itemId: string, variantId: string | null) => {
    const material = materialList.find((m: any) => 
      m.item_id === itemId && m.variant_id === variantId
    );
    return material?.unit || 'nos';
  };

  if (isLoading) {
    return <div className="p-6 text-center">Loading usage data...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold">Daily Material Usage</h2>
          <p className="text-sm text-gray-600">Log material consumption for the selected date</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-gray-500" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          />
        </div>
      </div>

      {!showForm && (
        <div className="mb-6">
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + Log New Usage
          </button>
        </div>
      )}

      {materialList.length === 0 ? (
        <div className="text-center py-12 bg-yellow-50 rounded-lg border-2 border-dashed border-yellow-200">
          <p className="text-yellow-700">
            No materials in project list. Please add materials to the Material List first.
          </p>
        </div>
      ) : (
        <>
          {showForm && (
            <div className="bg-gray-50 p-4 rounded-lg mb-6 border">
              <h3 className="font-medium mb-4">Log New Usage</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Material *</label>
                <select
                  value={formData.item_id}
                  onChange={(e) => {
                    const selected = materialList.find((m: any) => m.item_id === e.target.value);
                    setFormData({ 
                      ...formData, 
                      item_id: e.target.value,
                      unit: selected?.unit || 'nos'
                    });
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select material</option>
                  {materialList.map((m: any) => (
                    <option key={m.id} value={m.item_id}>
                      {m.materials?.display_name || m.materials?.name}
                      {m.company_variants?.variant_name && ` (${m.company_variants.variant_name})`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Quantity Used *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.quantity_used}
                  onChange={(e) => setFormData({ ...formData, quantity_used: e.target.value })}
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
                <label className="block text-sm font-medium mb-1">Activity</label>
                <input
                  type="text"
                  value={formData.activity}
                  onChange={(e) => setFormData({ ...formData, activity: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="e.g., Foundation work"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Remarks</label>
                <input
                  type="text"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Optional notes"
                />
              </div>
              <div className="md:col-span-2 flex items-end">
                <button
                  onClick={handleLog}
                  disabled={logMutation.isPending}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <CheckCircle size={16} />
                  {logMutation.isPending ? 'Logging...' : 'Log Usage'}
                </button>
              </div>
            </div>
          </div>
          )}

          {dailyUsage.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed">
              <p className="text-gray-500">No usage logged for {selectedDate}</p>
            </div>
          ) : (
            <div className="bg-white border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b">
                <h3 className="font-medium">Usage Log for {selectedDate}</h3>
              </div>
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">Material</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Variant</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Quantity Used</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Unit</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Activity</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Remarks</th>
                    <th className="px-4 py-3 text-center text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyUsage.map((item: any) => (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      {editingId === item.id ? (
                        <>
                          <td className="px-4 py-3">
                            <span className="font-medium">{getMaterialName(item.item_id)}</span>
                          </td>
                          <td className="px-4 py-3 text-sm">{getVariantName(item.variant_id)}</td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              step="0.01"
                              value={formData.quantity_used}
                              onChange={(e) => setFormData({ ...formData, quantity_used: e.target.value })}
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
                              type="text"
                              value={formData.activity}
                              onChange={(e) => setFormData({ ...formData, activity: e.target.value })}
                              className="w-full px-2 py-1 border rounded"
                            />
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
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 font-medium">{getMaterialName(item.item_id)}</td>
                          <td className="px-4 py-3 text-sm">{getVariantName(item.variant_id)}</td>
                          <td className="px-4 py-3 text-right font-medium">{item.quantity_used}</td>
                          <td className="px-4 py-3">{item.unit}</td>
                          <td className="px-4 py-3 text-sm">{item.activity || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.remarks || '-'}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => handleEdit(item)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              >
                                <Save size={16} />
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
        </>
      )}
    </div>
  );
}
