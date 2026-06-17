import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, Trash2, Plus } from 'lucide-react';

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
  const [bomSearchText, setBomSearchText] = useState('');
  const [isBomDropdownOpen, setIsBomDropdownOpen] = useState(false);
  const [materialSearchText, setMaterialSearchText] = useState<Record<number, string>>({});
  const [openDropdownIndex, setOpenDropdownIndex] = useState<number>(-1);

  // Click-Outside handler for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.bom-dropdown-container')) {
        setIsBomDropdownOpen(false);
      }
      if (!target.closest('.material-dropdown-container')) {
        setOpenDropdownIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      setBomSearchText('');
      setIsBomDropdownOpen(false);
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
    // clean up row search text
    const nextSearchText = { ...materialSearchText };
    delete nextSearchText[index];
    setMaterialSearchText(nextSearchText);
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
        .eq('item_classification', 'raw_material')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id
  });

  // ─── Design System style tokens ───
  const sectionHeaderStyle: React.CSSProperties = { fontWeight: 600, fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' };
  const headerFieldStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px' };
  const labelColStyle: React.CSSProperties = { minWidth: '90px', maxWidth: '90px', fontWeight: 600, fontSize: '11px', color: '#374151', textAlign: 'right', paddingRight: '4px' };
  const fieldColStyle: React.CSSProperties = { flex: 1 };
  const inputStyle: React.CSSProperties = { padding: '4px 8px', fontSize: '12px', width: '100%', height: '28px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff', color: '#111827', outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s' };
  const dropdownStyle: React.CSSProperties = { position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'white', border: '1px solid #d1d5db', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto' };

  const renderHeaderField = (label: string, field: React.ReactNode, isLast = false) => (
    <div style={{ ...headerFieldStyle, marginBottom: isLast ? 0 : '10px', padding: '4px 6px', borderRadius: '4px', transition: 'background 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.background = '#f0f7ff'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <span style={labelColStyle}>{label}</span>
      <div style={fieldColStyle}>{field}</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100%', background: '#fafafa' }}>
      {/* Header Bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyBetween: 'space-between', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onCancel} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#6b7280', fontSize: '12px', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', transition: 'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            <ArrowLeft size={14} /> Back
          </button>
          <div style={{ width: '1px', height: '20px', background: '#e5e7eb' }} />
          <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>Create Job Card</h1>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Issue raw materials for factory production run</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={onCancel} style={{ padding: '6px 14px', border: '1px solid #d1d5db', background: '#fff', color: '#374151', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
            onMouseDown={e => { e.currentTarget.style.background = '#e5e7eb'; }}
            onMouseUp={e => { e.currentTarget.style.background = '#f3f4f6'; }}>Cancel</button>
          <button onClick={() => saveJobCard.mutate()} disabled={!formData.bom_id || !formData.planned_qty || saveJobCard.isPending}
            style={{ padding: '6px 14px', background: '#185FA5', border: '1px solid #185FA5', color: '#fff', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: saveJobCard.isPending || (!formData.bom_id || !formData.planned_qty) ? 'not-allowed' : 'pointer', opacity: saveJobCard.isPending || (!formData.bom_id || !formData.planned_qty) ? 0.6 : 1, transition: 'all 0.15s' }}
            onMouseEnter={e => { if (!saveJobCard.isPending && formData.bom_id && formData.planned_qty) { e.currentTarget.style.background = '#0C447C'; e.currentTarget.style.borderColor = '#0C447C'; }}}
            onMouseLeave={e => { if (!saveJobCard.isPending && formData.bom_id && formData.planned_qty) { e.currentTarget.style.background = '#185FA5'; e.currentTarget.style.borderColor = '#185FA5'; }}}
            onMouseDown={e => { if (!saveJobCard.isPending && formData.bom_id && formData.planned_qty) { e.currentTarget.style.transform = 'scale(0.98)'; }}}
            onMouseUp={e => { if (!saveJobCard.isPending && formData.bom_id && formData.planned_qty) { e.currentTarget.style.transform = 'scale(1)'; }}}>
            {saveJobCard.isPending ? 'Creating...' : 'Create Job Card'}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr', gap: '24px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Card 1: Job Header Details */}
            <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '6px', border: '1px solid #e5e7eb', transition: 'border-color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#93c5fd'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
                
                {/* Column 1 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={sectionHeaderStyle}>BOM Selection</div>
                  
                  {renderHeaderField('Select BOM *', (
                    <div className="bom-dropdown-container" style={{ position: 'relative', width: '100%' }}>
                      <input type="text" style={inputStyle} value={isBomDropdownOpen ? bomSearchText : (formData.product_name ? `${formData.product_name} (${formData.output_unit})` : '')}
                        onChange={(e) => { setBomSearchText(e.target.value); setIsBomDropdownOpen(true); }}
                        onFocus={() => setIsBomDropdownOpen(true)}
                        placeholder="Search formulas by product name..." />
                      {isBomDropdownOpen && (
                        <div style={dropdownStyle}>
                          {(boms || [])
                            .filter(b => {
                              const q = bomSearchText.toLowerCase();
                              return !q || b.product_name.toLowerCase().includes(q) || (b.bom_code || '').toLowerCase().includes(q);
                            })
                            .map(b => (
                              <div key={b.id} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                                onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                onClick={() => handleBomSelect(b.id)}
                              >
                                <div style={{ fontWeight: 500 }}>{b.product_name}</div>
                                <div style={{ fontSize: '10px', color: '#6b7280' }}>Code: {b.bom_code} • Output: {b.output_qty} {b.output_unit}</div>
                              </div>
                            ))}
                          {(boms || []).filter(b => {
                            const q = bomSearchText.toLowerCase();
                            return !q || b.product_name.toLowerCase().includes(q) || (b.bom_code || '').toLowerCase().includes(q);
                          }).length === 0 && (
                            <div style={{ padding: '6px 12px', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>No BOMs found</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {renderHeaderField('Planned Qty *', (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input type="number" style={inputStyle} value={formData.planned_qty || ''} onChange={(e) => setFormData({ ...formData, planned_qty: Number(e.target.value) })} placeholder="Qty to produce" />
                      {formData.output_unit && (
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', background: '#e5e7eb', padding: '4px 8px', borderRadius: '4px' }}>
                          {formData.output_unit}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Column 2 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={sectionHeaderStyle}>Job Options</div>
                  
                  {renderHeaderField('Priority:', (
                    <select style={inputStyle} value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}>
                      <option value="low">Low Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="high">High Priority</option>
                      <option value="urgent">Urgent Priority</option>
                    </select>
                  ))}

                  {renderHeaderField('Remarks:', (
                    <input type="text" style={inputStyle} value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} placeholder="Internal production notes" />
                  ))}
                </div>
              </div>
            </div>

            {/* Card 2: Materials List */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>Materials to Issue</h2>
                <button type="button" onClick={addMaterial}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', border: '1px solid #d1d5db', background: '#fff', color: '#000000', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}>
                  <Plus size={13} /> Add Material
                </button>
              </div>

              <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'visible' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>Material Name</th>
                      <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textAlign: 'right' }}>BOM Qty</th>
                      <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textAlign: 'right' }}>Wastage %</th>
                      <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textAlign: 'right' }}>Planned Outward Qty</th>
                      <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#4b5563', w: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>
                          Select a BOM and input planned quantity to view raw materials list.
                        </td>
                      </tr>
                    ) : (
                      materials.map((mat, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '8px 12px', fontSize: '12px', color: '#1f2937' }}>
                            {mat.is_additional ? (
                              <div className="material-dropdown-container" style={{ position: 'relative', width: '100%' }}>
                                <input type="text" style={{ ...inputStyle, height: '26px' }}
                                  value={openDropdownIndex === index ? (materialSearchText[index] || '') : (mat.material_name || '')}
                                  onChange={(e) => {
                                    setMaterialSearchText({ ...materialSearchText, [index]: e.target.value });
                                    setOpenDropdownIndex(index);
                                  }}
                                  onFocus={() => setOpenDropdownIndex(index)}
                                  placeholder="Search raw material..." />
                                {openDropdownIndex === index && (
                                  <div style={dropdownStyle}>
                                    {(allMaterials || [])
                                      .filter(m => {
                                        const q = (materialSearchText[index] || '').toLowerCase();
                                        return !q || m.name.toLowerCase().includes(q);
                                      })
                                      .map(m => (
                                        <div key={m.id} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6' }}
                                          onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                                          onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                          onClick={() => {
                                            updateMaterial(index, 'material_id', m.id);
                                            updateMaterial(index, 'material_name', m.name);
                                            updateMaterial(index, 'unit', m.unit || 'kg');
                                            setOpenDropdownIndex(-1);
                                          }}
                                        >{m.name}</div>
                                      ))}
                                    {(allMaterials || []).filter(m => {
                                      const q = (materialSearchText[index] || '').toLowerCase();
                                      return !q || m.name.toLowerCase().includes(q);
                                    }).length === 0 && (
                                      <div style={{ padding: '6px 12px', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>No materials found</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 500 }}>{mat.material_name}</span>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', fontSize: '12px', color: '#4b5563', textAlign: 'right' }}>
                            {mat.is_additional ? (
                              <input type="number" style={{ ...inputStyle, width: '80px', height: '24px', textAlign: 'right' }} value={mat.required_qty || ''}
                                onChange={(e) => {
                                  const reqVal = Number(e.target.value);
                                  const planVal = Math.ceil(reqVal * (1 + mat.wastage_pct / 100) * 100) / 100;
                                  updateMaterial(index, 'required_qty', reqVal);
                                  updateMaterial(index, 'planned_qty', planVal);
                                }} />
                            ) : (
                              `${mat.required_qty} ${mat.unit}`
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', fontSize: '12px', color: '#4b5563', textAlign: 'right' }}>
                            {mat.is_additional ? (
                              <input type="number" style={{ ...inputStyle, width: '60px', height: '24px', textAlign: 'right' }} value={mat.wastage_pct || ''}
                                onChange={(e) => {
                                  const wasteVal = Number(e.target.value);
                                  const planVal = Math.ceil(mat.required_qty * (1 + wasteVal / 100) * 100) / 100;
                                  updateMaterial(index, 'wastage_pct', wasteVal);
                                  updateMaterial(index, 'planned_qty', planVal);
                                }} />
                            ) : (
                              `${mat.wastage_pct}%`
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', fontSize: '12px', color: '#111827', fontWeight: 600, textAlign: 'right' }}>
                            {mat.is_additional ? (
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                <input type="number" style={{ ...inputStyle, width: '80px', height: '24px', textAlign: 'right' }} value={mat.planned_qty || ''}
                                  onChange={(e) => updateMaterial(index, 'planned_qty', Number(e.target.value))} />
                                <span style={{ fontSize: '10px', color: '#6b7280' }}>{mat.unit}</span>
                              </div>
                            ) : (
                              `${mat.planned_qty} ${mat.unit}`
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            {mat.is_additional ? (
                              <button type="button" onClick={() => removeMaterial(index)}
                                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', border: '1px solid #d1d5db', background: '#fff', color: '#000000', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}>
                                <Trash2 size={13} /> Delete
                              </button>
                            ) : (
                              <span style={{ color: '#d1d5db' }}>—</span>
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

          {/* Sidebar Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Sidebar Summary Card */}
            <div style={{ background: '#white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: '0 0 16px 0', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px' }}>Summary</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Product:</span>
                  <span style={{ fontWeight: 600, color: '#1f2937' }}>{formData.product_name || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Planned Qty:</span>
                  <span style={{ fontWeight: 600, color: '#1f2937' }}>{formData.planned_qty ? `${formData.planned_qty} ${formData.output_unit}` : '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Priority:</span>
                  <span style={{ fontWeight: 600, color: '#1f2937', textTransform: 'capitalize' }}>{formData.priority}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Materials Count:</span>
                  <span style={{ fontWeight: 600, color: '#1f2937' }}>{materials.length} items</span>
                </div>
              </div>
            </div>

            {/* Next Steps Guide Box */}
            <div style={{ background: '#f8f9fa', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '16px' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#374151', margin: '0 0 8px 0' }}>Job Card Lifecycle</h3>
              <ul style={{ paddingLeft: '16px', margin: 0, fontSize: '11px', color: '#6b7280', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>Job cards are created in <strong>Draft</strong> status and raw materials are reserved.</li>
                <li>When production begins, issuing materials will deduct stock from the <strong>Main Store</strong> and transfer it to the <strong>WIP Warehouse</strong>.</li>
                <li>All outward actions are tracked automatically in the material outward log for audit records.</li>
              </ul>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
