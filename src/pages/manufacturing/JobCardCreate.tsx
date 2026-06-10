import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';

type JobCardCreateProps = {
  onSuccess: () => void;
  onCancel: () => void;
};

type MaterialItem = {
  material_id: string;
  material_name: string;
  required_qty: number;
  unit: string;
  wastage_pct: number;
  planned_qty: number;
  is_additional: boolean;
};

export default function JobCardCreate({ onSuccess, onCancel }: JobCardCreateProps) {
  const { organisation, user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const preselectedBomId = searchParams.get('bom');

  const [formData, setFormData] = useState({
    bom_id: preselectedBomId || '',
    product_name: '',
    planned_qty: 0,
    output_unit: 'nos',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    remarks: ''
  });

  const [materials, setMaterials] = useState<MaterialItem[]>([]);

  const { data: boms } = useQuery({
    queryKey: ['boms-for-job-card', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('bom_headers')
        .select('*')
        .eq('organisation_id', organisation.id)
        .eq('is_active', true)
        .order('product_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id
  });

  const { data: bomItems } = useQuery({
    queryKey: ['bom-items', formData.bom_id],
    queryFn: async () => {
      if (!formData.bom_id) return [];
      const { data, error } = await supabase
        .from('bom_items')
        .select('*, materials(name, unit)')
        .eq('bom_id', formData.bom_id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!formData.bom_id
  });

  useEffect(() => {
    if (bomItems && formData.planned_qty > 0) {
      const selectedBom = boms?.find(b => b.id === formData.bom_id);
      if (selectedBom) {
        const scalingFactor = formData.planned_qty / selectedBom.output_qty;
        setMaterials(bomItems.map((item: any) => ({
          material_id: item.material_id,
          material_name: item.materials?.name || '',
          required_qty: item.required_qty,
          unit: item.unit || item.materials?.unit || 'kg',
          wastage_pct: item.wastage_pct || 5,
          planned_qty: Math.ceil(item.required_qty * scalingFactor * (1 + (item.wastage_pct || 5) / 100) * 100) / 100,
          is_additional: false
        })));
      }
    }
  }, [bomItems, formData.planned_qty, formData.bom_id, boms]);

  const handleBomSelect = (bomId: string) => {
    const bom = boms?.find(b => b.id === bomId);
    if (bom) {
      setFormData({
        ...formData,
        bom_id: bomId,
        product_name: bom.product_name,
        output_unit: bom.output_unit
      });
    }
  };

  const generateJobCardNo = async () => {
    try {
      const { data, error } = await supabase.rpc('generate_job_card_no', { org_id: organisation?.id });
      if (error || !data) throw error;
      return data as string;
    } catch {
      const { data } = await supabase
        .from('job_cards')
        .select('job_card_no')
        .eq('organisation_id', organisation?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const last = data?.job_card_no;
      const next = last ? parseInt(last.replace('JC-', '')) + 1 : 1;
      return `JC-${String(next).padStart(4, '0')}`;
    }
  };

  const saveJobCard = useMutation({
    mutationFn: async () => {
      if (!organisation?.id || !user?.id) throw new Error('Not authenticated');

      const jobCardNo = await generateJobCardNo();

      const { data: jobCard, error: jcError } = await supabase
        .from('job_cards')
        .insert({
          job_card_no: jobCardNo,
          bom_id: formData.bom_id,
          product_name: formData.product_name,
          planned_qty: formData.planned_qty,
          output_unit: formData.output_unit,
          priority: formData.priority,
          remarks: formData.remarks,
          status: 'draft',
          issued_by: user.id,
          organisation_id: organisation.id
        })
        .select()
        .single();
      if (jcError) throw jcError;

      const materialsToInsert = materials.map(mat => ({
        job_card_id: jobCard.id,
        material_id: mat.material_id,
        planned_qty: mat.planned_qty,
        unit: mat.unit,
        is_additional: mat.is_additional,
        status: 'reserved'
      }));

      if (materialsToInsert.length > 0) {
        const { error: matError } = await supabase
          .from('job_card_materials')
          .insert(materialsToInsert);
        if (matError) throw matError;
      }

      return jobCard;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-cards'] });
      onSuccess();
    }
  });

  const addMaterial = () => {
    setMaterials([...materials, {
      material_id: '',
      material_name: '',
      required_qty: 0,
      unit: 'kg',
      wastage_pct: 5,
      planned_qty: 0,
      is_additional: true
    }]);
  };

  const removeMaterial = (index: number) => {
    setMaterials(materials.filter((_, i) => i !== index));
  };

  const updateMaterial = (index: number, field: keyof MaterialItem, value: any) => {
    const newMaterials = [...materials];
    newMaterials[index] = { ...newMaterials[index], [field]: value };
    setMaterials(newMaterials);
  };

  const { data: allMaterials } = useQuery({
    queryKey: ['materials-for-additional', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('materials')
        .select('id, name, unit, category')
        .eq('organisation_id', organisation.id)
        .eq('show_in_bom', true)
        .eq('is_manufactured', false)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Create Job Card</h1>
          <p className="text-zinc-500 mt-1">Issue materials for production</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="h-10 px-5 border border-zinc-200 text-zinc-700 rounded-lg font-medium hover:bg-zinc-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => saveJobCard.mutate()}
            disabled={!formData.bom_id || !formData.planned_qty || saveJobCard.isPending}
            className="h-10 px-5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saveJobCard.isPending ? 'Creating...' : 'Create Job Card'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-zinc-200 rounded-lg p-6">
            <h2 className="text-lg font-medium text-zinc-900 mb-4">Job Card Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">Select BOM *</label>
                <select
                  value={formData.bom_id}
                  onChange={(e) => handleBomSelect(e.target.value)}
                  className="w-full h-10 px-4 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select a BOM</option>
                  {boms?.map((bom) => (
                    <option key={bom.id} value={bom.id}>
                      {bom.bom_code} - {bom.product_name} ({bom.output_qty} {bom.output_unit})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">Planned Qty *</label>
                <input
                  type="number"
                  value={formData.planned_qty || ''}
                  onChange={(e) => setFormData({ ...formData, planned_qty: Number(e.target.value) })}
                  placeholder="Qty to produce"
                  className="w-full h-10 px-4 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                  className="w-full h-10 px-4 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">Remarks</label>
                <input
                  type="text"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Optional notes"
                  className="w-full h-10 px-4 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-zinc-900">Materials to Issue</h2>
              <button
                onClick={addMaterial}
                className="h-10 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Add Material
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">Material</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">BOM Qty</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">Planned Qty</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">Wastage %</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                        Select a BOM and enter planned qty to see materials
                      </td>
                    </tr>
                  ) : (
                    materials.map((mat, index) => (
                      <tr key={index} className="border-b border-zinc-100">
                        <td className="px-4 py-4">
                          {mat.is_additional ? (
                            <select
                              value={mat.material_id}
                              onChange={(e) => {
                                const material = allMaterials?.find(m => m.id === e.target.value);
                                updateMaterial(index, 'material_id', e.target.value);
                                updateMaterial(index, 'material_name', material?.name || '');
                              }}
                              className="w-full h-10 px-4 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500"
                            >
                              <option value="">Select material</option>
                              {allMaterials?.map((m) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="font-medium text-zinc-900">{mat.material_name}</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-zinc-700">{mat.required_qty} {mat.unit}</td>
                        <td className="px-4 py-4 text-zinc-700">{mat.planned_qty} {mat.unit}</td>
                        <td className="px-4 py-4 text-zinc-700">{mat.wastage_pct}%</td>
                        <td className="px-4 py-4">
                          {mat.is_additional && (
                            <button
                              onClick={() => removeMaterial(index)}
                              className="text-red-600 hover:text-red-700 text-sm font-medium"
                            >
                              Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white border border-zinc-200 rounded-lg p-6 sticky top-6">
            <h2 className="text-lg font-medium text-zinc-900 mb-4">Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">BOM</span>
                <span className="font-medium text-zinc-900">{formData.product_name || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Planned Qty</span>
                <span className="font-medium text-zinc-900">{formData.planned_qty || '-'} {formData.output_unit}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Materials</span>
                <span className="font-medium text-zinc-900">{materials.length}</span>
              </div>
            </div>

            <div className="mt-6 p-4 bg-zinc-50 rounded-lg">
              <h3 className="text-sm font-medium text-zinc-700 mb-2">Next steps</h3>
              <ul className="text-xs text-zinc-500 space-y-1">
                <li>• Job card created in draft status</li>
                <li>• Click "Issue Materials" to transfer to WIP</li>
                <li>• Materials move from Main Store → Production Floor</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
