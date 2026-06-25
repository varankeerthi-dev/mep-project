import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Loader2, ArrowLeft } from 'lucide-react';

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

  const generateScheduleNo = async (): Promise<string> => {
    try {
      const { data, error } = await supabase.rpc('generate_schedule_no', { org_id: organisation?.id });
      if (error || !data) throw error || new Error('RPC returned no data');
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
      if (!scheduleId && !scheduleNo) throw new Error('Failed to generate schedule number');

      const headerData: any = {
        schedule_name: formData.schedule_name,
        schedule_date: formData.schedule_date,
        shift: formData.shift,
        status: 'draft',
        remarks: formData.remarks || null,
        created_by: user.id,
        organisation_id: organisation.id
      };

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
          .insert({
            ...headerData,
            schedule_no: scheduleNo
          })
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

  // ─── STYLING TOKENS ───────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    padding: '4px 12px',
    fontSize: '12px',
    height: '32px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    background: '#fff',
    color: '#111827',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    width: '100%'
  };

  const sectionHeaderStyle: React.CSSProperties = {
    fontWeight: 600,
    fontSize: '11px',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '12px',
    borderBottom: '1px solid #f3f4f6',
    paddingBottom: '6px'
  };

  const renderHeaderField = (label: string, field: React.ReactNode, isLast = false) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: isLast ? 0 : '8px' }}>
      <span style={{ minWidth: '95px', maxWidth: '95px', fontWeight: 600, fontSize: '11px', color: '#374151', textAlign: 'right' }}>{label}</span>
      <div style={{ flex: 1 }}>{field}</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100%', background: '#fafafa' }}>
      {/* Header Bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={onCancel}
            style={{
              height: '32px',
              width: '32px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              background: '#fff',
              color: '#374151',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
          >
            <ArrowLeft size={14} />
          </button>
          <div>
            <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>
              {scheduleId ? 'Edit Production Schedule' : 'Create Production Schedule'}
            </h1>
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>Group multiple products for a production run</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '6px 14px',
              border: '1px solid #d1d5db',
              background: '#fff',
              color: '#374151',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
          >
            Cancel
          </button>
          <button
            onClick={() => saveSchedule.mutate()}
            disabled={!formData.schedule_name || saveSchedule.isPending}
            style={{
              padding: '6px 14px',
              background: '#185FA5',
              border: '1px solid #185FA5',
              color: '#fff',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: (!formData.schedule_name || saveSchedule.isPending) ? 'not-allowed' : 'pointer',
              opacity: (!formData.schedule_name || saveSchedule.isPending) ? 0.6 : 1,
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            onMouseEnter={e => { if (formData.schedule_name && !saveSchedule.isPending) { e.currentTarget.style.background = '#0C447C'; e.currentTarget.style.borderColor = '#0C447C'; }}}
            onMouseLeave={e => { if (formData.schedule_name && !saveSchedule.isPending) { e.currentTarget.style.background = '#185FA5'; e.currentTarget.style.borderColor = '#185FA5'; }}}
          >
            {saveSchedule.isPending && <Loader2 size={13} className="animate-spin" />}
            {saveSchedule.isPending ? 'Saving...' : 'Save Schedule'}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr', gap: '24px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Details Section */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px' }}>
              <div style={sectionHeaderStyle}>Schedule Details</div>
              
              <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
                  {/* Column 1 */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {renderHeaderField('Schedule Name *', (
                      <input
                        type="text"
                        value={formData.schedule_name}
                        onChange={(e) => setFormData({ ...formData, schedule_name: e.target.value })}
                        placeholder="e.g., Monday Morning Shift"
                        style={inputStyle}
                      />
                    ))}
                    {renderHeaderField('Date *', (
                      <input
                        type="date"
                        value={formData.schedule_date}
                        onChange={(e) => setFormData({ ...formData, schedule_date: e.target.value })}
                        style={inputStyle}
                      />
                    ))}
                  </div>

                  {/* Column 2 */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {renderHeaderField('Shift', (
                      <select
                        value={formData.shift}
                        onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                        style={inputStyle}
                      >
                        <option value="day">Day</option>
                        <option value="night">Night</option>
                        <option value="custom">Custom</option>
                      </select>
                    ))}
                    {renderHeaderField('Remarks', (
                      <input
                        type="text"
                        value={formData.remarks}
                        onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                        placeholder="Optional notes"
                        style={inputStyle}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Products Section */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px' }}>
                <div style={{ fontWeight: 600, fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                  Products to Produce
                </div>
                <button
                  onClick={addItem}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    border: '1px solid #185FA5',
                    background: '#185FA5',
                    color: '#fff',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#0C447C'; e.currentTarget.style.borderColor = '#0C447C'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#185FA5'; e.currentTarget.style.borderColor = '#185FA5'; }}
                >
                  <Plus size={12} /> Add Product
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {items.map((item, index) => (
                  <div key={index} style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '16px', background: '#fcfcfc' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#4b5563', marginBottom: '4px', textTransform: 'uppercase' }}>Product (BOM) *</label>
                        <select
                          value={item.bom_id}
                          onChange={(e) => handleBomSelect(index, e.target.value)}
                          style={inputStyle}
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
                        <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#4b5563', marginBottom: '4px', textTransform: 'uppercase' }}>Planned Qty *</label>
                        <input
                          type="number"
                          value={item.planned_qty || ''}
                          onChange={(e) => updateItem(index, 'planned_qty', Number(e.target.value))}
                          style={inputStyle}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        {items.length > 1 && (
                          <button
                            onClick={() => removeItem(index)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '6px 12px',
                              border: '1px solid #d1d5db',
                              background: '#fff',
                              color: '#000000',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 500,
                              cursor: 'pointer',
                              height: '32px',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
                          >
                            <Trash2 size={13} /> Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar Summary Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px', position: 'sticky', top: '70px' }}>
              <div style={sectionHeaderStyle}>Summary</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Total Products:</span>
                  <span style={{ fontWeight: 600, color: '#1f2937' }}>{items.filter(i => i.bom_id).length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Date:</span>
                  <span style={{ fontWeight: 600, color: '#1f2937' }}>{formData.schedule_date}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Shift:</span>
                  <span style={{ fontWeight: 600, color: '#1f2937', textTransform: 'capitalize' }}>{formData.shift}</span>
                </div>
              </div>

              <div style={{ marginTop: '20px', padding: '12px', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                <h3 style={{ fontSize: '11px', fontWeight: 600, color: '#374151', margin: '0 0 6px 0', textTransform: 'uppercase' }}>How it works</h3>
                <ul style={{ paddingLeft: '14px', margin: 0, fontSize: '10px', color: '#6b7280', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <li>Group multiple products for one production run</li>
                  <li>System aggregates material requirements</li>
                  <li>Create job cards for each product</li>
                  <li>Track production progress per product</li>
                </ul>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
