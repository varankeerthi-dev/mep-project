import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { Switch } from '../../components/ui/switch';

type BOMEditorProps = {
  onSuccess: () => void;
  onCancel: () => void;
};

type BOMItem = {
  material_id: string;
  material_name: string;
  required_qty: number;
  unit: string;
  wastage_pct: number;
  notes: string;
};

export default function BOMEditor({ onSuccess, onCancel }: BOMEditorProps) {
  const { organisation, user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const bomId = searchParams.get('id');

  const [formData, setFormData] = useState({
    bom_code: '',
    product_name: '',
    output_qty: 1,
    output_unit: 'nos',
    description: '',
    is_active: true
  });

  const [items, setItems] = useState<BOMItem[]>([
    { material_id: '', material_name: '', required_qty: 0, unit: 'kg', wastage_pct: 5, notes: '' }
  ]);

  const { data: materials } = useQuery({
    queryKey: ['materials-for-bom', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('materials')
        .select('id, name, unit')
        .eq('organisation_id', organisation.id)
        .eq('show_in_bom', true)
        .eq('is_manufactured', false)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id
  });

  useEffect(() => {
    if (!bomId) return;
    const load = async () => {
      const { data: bom } = await supabase.from('bom_headers').select('*').eq('id', bomId).single();
      if (!bom) return;

      setFormData({
        bom_code: bom.bom_code,
        product_name: bom.product_name,
        output_qty: bom.output_qty,
        output_unit: bom.output_unit,
        description: bom.description || '',
        is_active: bom.is_active
      });

      const { data: bomItems } = await supabase.from('bom_items').select('*, materials(name)').eq('bom_id', bomId);
      if (bomItems?.length) {
        setItems(bomItems.map((item: any) => ({
          material_id: item.material_id,
          material_name: item.materials?.name || '',
          required_qty: item.required_qty,
          unit: item.unit,
          wastage_pct: item.wastage_pct || 5,
          notes: item.notes || ''
        })));
      }
    };
    load();
  }, [bomId]);

  const generateBomCode = async () => {
    const { data } = await supabase.rpc('generate_bom_code');
    return data as string;
  };

  const saveBOM = useMutation({
    mutationFn: async () => {
      if (!organisation?.id || !user?.id) throw new Error('Not authenticated');

      const bomCode = formData.bom_code || await generateBomCode();
      const headerData = {
        bom_code: bomCode,
        product_name: formData.product_name,
        output_qty: formData.output_qty,
        output_unit: formData.output_unit,
        description: formData.description,
        is_active: formData.is_active,
        organisation_id: organisation.id
      };

      const headerResult = bomId
        ? await supabase.from('bom_headers').update(headerData).eq('id', bomId).select().single()
        : await supabase.from('bom_headers').insert(headerData).select().single();

      if (headerResult.error) throw headerResult.error;

      const savedBom = headerResult.data;
      if (bomId) await supabase.from('bom_items').delete().eq('bom_id', bomId);

      const payload = items
        .filter(item => item.material_id && item.required_qty > 0)
        .map(item => ({
          bom_id: savedBom.id,
          material_id: item.material_id,
          required_qty: item.required_qty,
          unit: item.unit,
          wastage_pct: item.wastage_pct,
          notes: item.notes
        }));

      if (payload.length) {
        const { error } = await supabase.from('bom_items').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boms'] });
      onSuccess();
    }
  });

  const addItem = () => setItems(prev => [...prev, { material_id: '', material_name: '', required_qty: 0, unit: 'kg', wastage_pct: 5, notes: '' }]);
  const removeItem = (index: number) => setItems(prev => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  const updateItem = (index: number, field: keyof BOMItem, value: any) => {
    setItems(prev => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const handleMaterialSelect = (index: number, materialId: string) => {
    const material = materials?.find(m => m.id === materialId);
    updateItem(index, 'material_id', materialId);
    updateItem(index, 'material_name', material?.name || '');
    updateItem(index, 'unit', material?.unit || 'kg');
  };

  return (
    <div className="p-6 max-w-[900px]">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium text-zinc-900">{bomId ? 'Edit BOM' : 'Create BOM'}</h1>
          <p className="text-[13px] text-zinc-500 mt-[3px]">Define raw materials for a finished product</p>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={onCancel} className="h-9 px-4 border border-zinc-200 bg-white text-zinc-900 rounded-lg text-[13px] font-medium inline-flex items-center gap-1.5 hover:bg-zinc-50 transition-colors">Cancel</button>
          <button onClick={() => saveBOM.mutate()} disabled={!formData.product_name || saveBOM.isPending} className="h-9 px-4 bg-[#185FA5] border border-[#185FA5] text-white rounded-lg text-[13px] font-medium inline-flex items-center gap-1.5 hover:bg-[#0C447C] hover:border-[#0C447C] transition-colors disabled:opacity-50">
            {saveBOM.isPending ? 'Saving...' : 'Save BOM'}
          </button>
        </div>
      </div>

      <div className="grid gap-6 items-start" style={{ gridTemplateColumns: 'minmax(0,1fr) 240px' }}>
        <div className="flex flex-col gap-6">
          <div className="bg-white border border-zinc-200 rounded-xl p-6">
            <p className="text-sm font-medium text-zinc-900 mb-6">Product details</p>
            <div className="grid grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-zinc-500">BOM code</label>
                <input value={formData.bom_code} onChange={(e) => setFormData({ ...formData, bom_code: e.target.value })} className="w-full h-[34px] px-2.5 text-[13px] bg-white text-zinc-900 border border-zinc-200 rounded-lg" placeholder="Auto-generated if empty" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-zinc-500">Product name <span className="text-red-600">*</span></label>
                <input value={formData.product_name} onChange={(e) => setFormData({ ...formData, product_name: e.target.value })} className="w-full h-[34px] px-2.5 text-[13px] bg-white text-zinc-900 border border-zinc-200 rounded-lg" placeholder="e.g. PP pressure pipe 110mm" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-zinc-500">Standard output <span className="text-red-600">*</span></label>
                <div className="flex gap-2">
                  <input type="number" value={formData.output_qty} onChange={(e) => setFormData({ ...formData, output_qty: Number(e.target.value) })} className="flex-1 h-[34px] px-2.5 text-[13px] bg-white text-zinc-900 border border-zinc-200 rounded-lg" />
                  <select value={formData.output_unit} onChange={(e) => setFormData({ ...formData, output_unit: e.target.value })} className="w-[90px] shrink-0 h-[34px] px-2.5 text-[13px] bg-white text-zinc-900 border border-zinc-200 rounded-lg">
                    <option value="kg">kg</option>
                    <option value="mtr">mtr</option>
                    <option value="nos">nos</option>
                    <option value="ft">ft</option>
                    <option value="sqm">sqm</option>
                    <option value="cum">cum</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-2 justify-end">
                <label className="text-xs font-medium text-zinc-500">Status</label>
                <Switch checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
              </div>
              <div className="flex flex-col gap-2 col-span-2">
                <label className="text-xs font-medium text-zinc-500">Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} className="w-full px-2.5 py-2 text-[13px] bg-white text-zinc-900 border border-zinc-200 rounded-lg resize-none" placeholder="Optional product description" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm font-medium text-zinc-900 m-0">Raw materials</p>
            </div>
            <div className="flex flex-col">
              {items.map((item, index) => (
                <div key={index} className="border border-zinc-200 rounded-lg p-6 bg-zinc-50" style={{ marginTop: index > 0 ? '24px' : undefined }}>
                  <div className="grid gap-6 items-end" style={{ gridTemplateColumns: 'minmax(0,2fr) 80px 90px 30px' }}>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-zinc-500">Material <span className="text-red-600">*</span></label>
                      <select value={item.material_id} onChange={(e) => handleMaterialSelect(index, e.target.value)} className="w-full h-[34px] px-2.5 text-[13px] bg-white text-zinc-900 border border-zinc-200 rounded-lg">
                        <option value="">Select material</option>
                        {materials?.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-zinc-500">Qty <span className="text-red-600">*</span></label>
                      <input type="number" value={item.required_qty || ''} onChange={(e) => updateItem(index, 'required_qty', Number(e.target.value))} className="w-full h-[34px] px-2.5 text-[13px] bg-white text-zinc-900 border border-zinc-200 rounded-lg" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-zinc-500">Unit</label>
                      <select value={item.unit} onChange={(e) => updateItem(index, 'unit', e.target.value)} className="w-full h-[34px] px-2.5 text-[13px] bg-white text-zinc-900 border border-zinc-200 rounded-lg">
                        <option value="kg">kg</option>
                        <option value="mtr">mtr</option>
                        <option value="nos">nos</option>
                        <option value="ft">ft</option>
                        <option value="sqm">sqm</option>
                        <option value="cum">cum</option>
                      </select>
                    </div>
                    <button onClick={() => removeItem(index)} disabled={items.length <= 1} className="w-[28px] h-[28px] border border-red-200 bg-transparent rounded-lg flex items-center justify-center text-red-600 disabled:opacity-30" aria-label="Remove material">−</button>
                  </div>
                  <div className="grid grid-cols-2 gap-6 mt-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-zinc-500">Wastage %</label>
                      <input type="number" value={item.wastage_pct || ''} onChange={(e) => updateItem(index, 'wastage_pct', Number(e.target.value))} className="w-full h-[34px] px-2.5 text-[13px] bg-white text-zinc-900 border border-zinc-200 rounded-lg" />
                      <span className="text-[11px] text-zinc-400">Applied during job card scaling</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-zinc-500">Notes</label>
                      <input type="text" value={item.notes} onChange={(e) => updateItem(index, 'notes', e.target.value)} className="w-full h-[34px] px-2.5 text-[13px] bg-white text-zinc-900 border border-zinc-200 rounded-lg" placeholder="Optional instructions" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-6 pt-6 border-t border-dashed border-zinc-200">
              <button onClick={addItem} className="flex items-center gap-1.5 bg-transparent border-none text-xs text-[#185FA5] cursor-pointer font-medium p-0 hover:text-[#0C447C] transition-colors">Add another material</button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 sticky top-6">
          <div className="bg-white border border-zinc-200 rounded-xl p-6">
            <p className="text-sm font-medium text-zinc-900 mb-6">Summary</p>
            <div className="flex justify-between items-center py-3 border-b border-zinc-200"><span className="text-xs text-zinc-500">Materials</span><span className="text-[13px] font-medium text-zinc-900">{items.filter(i => i.material_id).length}</span></div>
            <div className="flex justify-between items-center py-3 border-b border-zinc-200"><span className="text-xs text-zinc-500">Standard output</span><span className="text-[13px] font-medium text-zinc-900">{formData.output_qty || '—'} {formData.output_unit}</span></div>
            <div className="flex justify-between items-center py-3"><span className="text-xs text-zinc-500">Status</span><span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${formData.is_active ? 'bg-[#E1F5EE] text-[#0F6E56]' : 'bg-zinc-100 text-zinc-500'}`}>{formData.is_active ? 'Active' : 'Inactive'}</span></div>
          </div>
          <div className="bg-white border border-zinc-200 rounded-xl p-6">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 mb-4">How it works</p>
            <div className="bg-zinc-50 rounded-lg p-6">
              <p className="text-[11px] text-zinc-500 leading-relaxed mb-4"><strong className="text-zinc-700">Standard output</strong> is your base unit - e.g. "6 mtr" of pipe. Materials are defined per this quantity.</p>
              <p className="text-[11px] text-zinc-500 leading-relaxed mb-4"><strong className="text-zinc-700">Wastage %</strong> is applied per material when creating job cards, not globally.</p>
              <p className="text-[11px] text-zinc-500 leading-relaxed m-0">Job cards <strong className="text-zinc-700">scale all quantities</strong> automatically based on planned production.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
