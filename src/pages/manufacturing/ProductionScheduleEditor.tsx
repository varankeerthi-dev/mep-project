import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';

type ProductionScheduleEditorProps = {
  onSuccess: () => void;
  onCancel: () => void;
};

type ScheduleItem = {
  bom_id: string;
  product_name: string;
  planned_qty: number;
  output_unit: string;
};

export default function ProductionScheduleEditor({ onSuccess, onCancel }: ProductionScheduleEditorProps) {
  const { organisation, user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const scheduleId = searchParams.get('id');

  const [formData, setFormData] = useState({
    schedule_name: '',
    schedule_date: new Date().toISOString().split('T')[0],
    shift: 'day',
    remarks: ''
  });

  const [items, setItems] = useState<ScheduleItem[]>([
    { bom_id: '', product_name: '', planned_qty: 0, output_unit: 'nos' }
  ]);

  const { data: boms } = useQuery({
    queryKey: ['boms-for-schedule', organisation?.id],
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

  useEffect(() => {
    if (scheduleId) {
      const loadSchedule = async () => {
        const { data: schedule, error } = await supabase
          .from('production_schedules')
          .select('*')
          .eq('id', scheduleId)
          .single();
        if (!error && schedule) {
          setFormData({
            schedule_name: schedule.schedule_name,
            schedule_date: schedule.schedule_date,
            shift: schedule.shift || 'day',
            remarks: schedule.remarks || ''
          });

          const { data: scheduleItems } = await supabase
            .from('production_schedule_items')
            .select('*')
            .eq('schedule_id', scheduleId);

          if (scheduleItems && scheduleItems.length > 0) {
            setItems(scheduleItems.map((item: any) => ({
              bom_id: item.bom_id,
              product_name: item.product_name,
              planned_qty: item.planned_qty,
              output_unit: item.output_unit
            })));
          }
        }
      };
      loadSchedule();
    }
  }, [scheduleId]);

  const generateScheduleNo = async () => {
    try {
      const { data, error } = await supabase.rpc('generate_schedule_no', { org_id: organisation?.id });
      if (error || !data) throw error;
      return data as string;
    } catch {
      const { data } = await supabase
        .from('production_schedules')
        .select('schedule_no')
        .eq('organisation_id', organisation?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const last = data?.schedule_no;
      const next = last ? parseInt(last.replace('PS-', '')) + 1 : 1;
      return `PS-${String(next).padStart(4, '0')}`;
    }
  };

  const saveSchedule = useMutation({
    mutationFn: async () => {
      if (!organisation?.id || !user?.id) throw new Error('Not authenticated');

      const scheduleNo = scheduleId ? undefined : await generateScheduleNo();

      const headerData: any = {
        schedule_name: formData.schedule_name,
        schedule_date: formData.schedule_date,
        shift: formData.shift,
        remarks: formData.remarks,
        created_by: user.id,
        organisation_id: organisation.id
      };

      if (scheduleNo) {
        headerData.schedule_no = scheduleNo;
      }

      let headerResult;
      if (scheduleId) {
        headerResult = await supabase
          .from('production_schedules')
          .update(headerData)
          .eq('id', scheduleId)
          .select()
          .single();
      } else {
        headerResult = await supabase
          .from('production_schedules')
          .insert(headerData)
          .select()
          .single();
      }

      if (headerResult.error) throw headerResult.error;
      const savedSchedule = headerResult.data;

      if (scheduleId) {
        await supabase.from('production_schedule_items').delete().eq('schedule_id', scheduleId);
      }

      const itemsToInsert = items
        .filter(item => item.bom_id && item.planned_qty > 0)
        .map(item => ({
          schedule_id: savedSchedule.id,
          bom_id: item.bom_id,
          product_name: item.product_name,
          planned_qty: item.planned_qty,
          output_unit: item.output_unit,
          status: 'pending'
        }));

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from('production_schedule_items')
          .insert(itemsToInsert);
        if (itemsError) throw itemsError;
      }

      return savedSchedule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-schedules'] });
      onSuccess();
    }
  });

  const addItem = () => {
    setItems([...items, { bom_id: '', product_name: '', planned_qty: 0, output_unit: 'nos' }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof ScheduleItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleBomSelect = (index: number, bomId: string) => {
    const bom = boms?.find(b => b.id === bomId);
    if (bom) {
      updateItem(index, 'bom_id', bomId);
      updateItem(index, 'product_name', bom.product_name);
      updateItem(index, 'output_unit', bom.output_unit);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            {scheduleId ? 'Edit Production Schedule' : 'Create Production Schedule'}
          </h1>
          <p className="text-zinc-500 mt-1">Group multiple products for a production run</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="h-10 px-5 border border-zinc-200 text-zinc-700 rounded-lg font-medium hover:bg-zinc-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => saveSchedule.mutate()}
            disabled={!formData.schedule_name || saveSchedule.isPending}
            className="h-10 px-5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saveSchedule.isPending ? 'Saving...' : 'Save Schedule'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-zinc-200 rounded-lg p-6">
            <h2 className="text-lg font-medium text-zinc-900 mb-4">Schedule Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">Schedule Name *</label>
                <input
                  type="text"
                  value={formData.schedule_name}
                  onChange={(e) => setFormData({ ...formData, schedule_name: e.target.value })}
                  placeholder="e.g., Monday Morning Shift"
                  className="w-full h-10 px-4 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">Date *</label>
                <input
                  type="date"
                  value={formData.schedule_date}
                  onChange={(e) => setFormData({ ...formData, schedule_date: e.target.value })}
                  className="w-full h-10 px-4 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">Shift</label>
                <select
                  value={formData.shift}
                  onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                  className="w-full h-10 px-4 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value="day">Day</option>
                  <option value="night">Night</option>
                  <option value="custom">Custom</option>
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
              <h2 className="text-lg font-medium text-zinc-900">Products to Produce</h2>
              <button
                onClick={addItem}
                className="h-10 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Add Product
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="border border-zinc-100 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-zinc-700 mb-2">Product (BOM) *</label>
                      <select
                        value={item.bom_id}
                        onChange={(e) => handleBomSelect(index, e.target.value)}
                        className="w-full h-10 px-4 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500"
                      >
                        <option value="">Select product</option>
                        {boms?.map((bom) => (
                          <option key={bom.id} value={bom.id}>
                            {bom.bom_code} - {bom.product_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-2">Planned Qty *</label>
                      <input
                        type="number"
                        value={item.planned_qty || ''}
                        onChange={(e) => updateItem(index, 'planned_qty', Number(e.target.value))}
                        className="w-full h-10 px-4 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="flex items-end">
                      {items.length > 1 && (
                        <button
                          onClick={() => removeItem(index)}
                          className="h-10 px-4 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white border border-zinc-200 rounded-lg p-6 sticky top-6">
            <h2 className="text-lg font-medium text-zinc-900 mb-4">Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Products</span>
                <span className="font-medium text-zinc-900">{items.filter(i => i.bom_id).length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Date</span>
                <span className="font-medium text-zinc-900">{formData.schedule_date}</span>
              </div>
            </div>

            <div className="mt-6 p-4 bg-zinc-50 rounded-lg">
              <h3 className="text-sm font-medium text-zinc-700 mb-2">How it works</h3>
              <ul className="text-xs text-zinc-500 space-y-1">
                <li>• Group multiple products for one production run</li>
                <li>• System aggregates material requirements</li>
                <li>• Create job cards for each product</li>
                <li>• Track production progress per product</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
