import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  getProjectMaterialList, 
  addMaterialToProjectList, 
  updateProjectMaterialList, 
  deleteFromProjectMaterialList,
  getMaterialReceipts
} from '../material-usage/api';
import { useMaterials } from '../hooks/useMaterials';
import { useVariants } from '../hooks/useVariants';
import { Plus, Trash2, Edit, Save, X, ChevronDown, ChevronRight, MoreVertical, Eye, Search, Download } from 'lucide-react';

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
    supply_qty: '',
    source_document: '',
    unit: '',
    rate: '',
    remarks: ''
  });

  const [showReceiptFetch, setShowReceiptFetch] = useState(false);
  const [selectedReceipts, setSelectedReceipts] = useState<Set<string>>(new Set());

  const { data: materialList = [], isLoading } = useQuery({
    queryKey: ['projectMaterialList', projectId, organisationId],
    queryFn: () => getProjectMaterialList(projectId, organisationId),
    enabled: !!projectId
  });

  const { data: receipts = [] } = useQuery({
    queryKey: ['materialReceipts', projectId, formData.item_id, formData.variant_id],
    queryFn: () => getMaterialReceipts(projectId, formData.item_id, formData.variant_id || null),
    enabled: showReceiptFetch && !!formData.item_id,
  });

  const addMutation = useMutation({
    mutationFn: (data: any) => addMaterialToProjectList({
      ...data,
      project_id: projectId,
      organisation_id: organisationId
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectMaterialList', projectId, organisationId] });
      setShowAddForm(false);
      setFormData({ item_id: '', variant_id: '', planned_qty: '', supply_qty: '', source_document: '', unit: '', rate: '', remarks: '' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) => 
      updateProjectMaterialList(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectMaterialList', projectId, organisationId] });
      setEditingId(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFromProjectMaterialList,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectMaterialList', projectId, organisationId] });
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
      supply_qty: parseFloat(formData.supply_qty || '0'),
      source_document: formData.source_document || null,
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
        supply_qty: parseFloat(formData.supply_qty || '0'),
        source_document: formData.source_document || null,
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
      supply_qty: (item.supply_qty ?? 0).toString(),
      source_document: item.source_document || '',
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
          <p className="text-sm text-zinc-600">Add materials to track planned quantities and rates</p>
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
        <div className="bg-zinc-50 p-4 rounded-lg mb-6 border">
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
              <label className="block text-sm font-medium mb-1">Supply Quantity</label>
              <input
                type="number"
                step="0.01"
                value={formData.supply_qty}
                onChange={(e) => setFormData({ ...formData, supply_qty: e.target.value })}
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
              <label className="block text-sm font-medium mb-1">Source Document</label>
              <input
                type="text"
                value={formData.source_document}
                onChange={(e) => setFormData({ ...formData, source_document: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="DC No / Invoice No / PO No"
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
          {formData.item_id && (
            <div className="mt-3 mb-3">
              <button
                type="button"
                onClick={() => { setSelectedReceipts(new Set()); setShowReceiptFetch(true); }}
                className="flex items-center gap-2 px-3 py-1.5 text-sm border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50"
              >
                <Download size={14} />
                Fetch from Receipts
              </button>
            </div>
          )}
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
              className="px-4 py-2 border rounded-lg hover:bg-zinc-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showReceiptFetch && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 9999, padding: '16px'
        }}>
          <div style={{
            background: '#fff', borderRadius: '8px', width: '100%', maxWidth: '600px',
            maxHeight: '80vh', overflow: 'auto', boxShadow: '0 4px 24px rgba(0,0,0,0.15)'
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: '1px solid #e5e5e5'
            }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
                Fetch from Receipts
              </h3>
              <button onClick={() => setShowReceiptFetch(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#525252' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>
                Select delivery receipts for <strong>{materials?.find(m => m.id === formData.item_id)?.name || formData.item_id}</strong>
                {formData.variant_id && <> — {variants?.find(v => v.id === formData.variant_id)?.variant_name}</>}
              </p>
              {receipts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', fontSize: '14px' }}>
                  No receipts found for this material
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', width: '40px' }}></th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>DC No</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Invoice</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Qty</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Supplier</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.map((r: any) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                        onClick={() => {
                          const next = new Set(selectedReceipts);
                          if (next.has(r.id)) next.delete(r.id); else next.add(r.id);
                          setSelectedReceipts(next);
                        }}
                      >
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <input type="checkbox" checked={selectedReceipts.has(r.id)}
                            onChange={() => {}}
                            style={{ cursor: 'pointer' }} />
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 500 }}>{r.dc_number || '-'}</td>
                        <td style={{ padding: '10px 12px' }}>{r.invoice_number || '-'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 500 }}>{r.qty_received}</td>
                        <td style={{ padding: '10px 12px', color: '#6b7280' }}>{r.supplier_name || '-'}</td>
                        <td style={{ padding: '10px 12px', color: '#6b7280' }}>
                          {r.created_at ? new Date(r.created_at).toLocaleDateString('en-GB') : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {receipts.length > 0 && (
                <div style={{ marginTop: '8px', fontSize: '13px', color: '#4b5563' }}>
                  Selected: <strong>{selectedReceipts.size}</strong> item(s) | Total Qty: <strong>
                    {receipts.filter((r: any) => selectedReceipts.has(r.id))
                      .reduce((sum: number, r: any) => sum + (r.qty_received || 0), 0)}
                  </strong>
                </div>
              )}
            </div>
            <div style={{
              display: 'flex', gap: '12px', justifyContent: 'flex-end',
              padding: '16px 20px', borderTop: '1px solid #e5e5e5'
            }}>
              <button onClick={() => setShowReceiptFetch(false)}
                style={{ padding: '8px 16px', border: '1px solid #d4d4d4', borderRadius: '4px', background: '#fff', cursor: 'pointer', fontSize: '14px' }}>
                Cancel
              </button>
              <button onClick={() => {
                const selected = receipts.filter((r: any) => selectedReceipts.has(r.id));
                const totalQty = selected.reduce((sum: number, r: any) => sum + (r.qty_received || 0), 0);
                const docRefs = selected.map((r: any) => [r.dc_number, r.invoice_number].filter(Boolean).join('/')).filter(Boolean).join(', ');
                setFormData(prev => ({
                  ...prev,
                  supply_qty: totalQty.toString(),
                  source_document: docRefs || prev.source_document,
                }));
                setShowReceiptFetch(false);
              }}
                disabled={selectedReceipts.size === 0}
                style={{
                  padding: '8px 16px', border: 'none', borderRadius: '4px',
                  background: selectedReceipts.size === 0 ? '#9ca3af' : '#171717',
                  color: '#fff', cursor: selectedReceipts.size === 0 ? 'not-allowed' : 'pointer', fontSize: '14px'
                }}>
                Apply to Row
              </button>
            </div>
          </div>
        </div>
      )}

      {materialList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', background: '#f9fafb', borderRadius: '8px', border: '2px dashed #e5e7eb' }}>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>No materials added yet. Click "Add Material" to start tracking.</p>
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
              <div style={{ display: 'grid', gridTemplateColumns: '36px minmax(180px, 1.5fr) 100px 80px 80px 80px 120px 80px 100px 100px 110px 70px', gap: '16px', padding: '12px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                <div></div>
                <div>Material</div>
                <div>Variant</div>
                <div style={{ textAlign: 'right' }}>Planned Qty</div>
                <div style={{ textAlign: 'right' }}>Supply Qty</div>
                <div style={{ textAlign: 'right', color: '#3b82f6' }}>Received Qty</div>
                <div>Source Document</div>
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
                    <div style={{ display: 'grid', gridTemplateColumns: '36px minmax(180px, 1.5fr) 100px 80px 80px 80px 120px 80px 100px 100px 110px 70px', gap: '16px', padding: '12px 16px', borderBottom: '1px solid #f3f4f6', alignItems: 'center', fontSize: '14px' }}>
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
                          type="number"
                          step="0.01"
                          value={formData.supply_qty}
                          onChange={(e) => setFormData({ ...formData, supply_qty: e.target.value })}
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '13px', textAlign: 'right' }}
                        />
                      </div>
                      <div style={{ textAlign: 'right', padding: '6px 8px', color: '#3b82f6', fontWeight: 500 }}>
                        {item.received_qty ?? 0}
                      </div>
                      <div>
                        <input
                          type="text"
                          value={formData.source_document}
                          onChange={(e) => setFormData({ ...formData, source_document: e.target.value })}
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '13px' }}
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
                        gridTemplateColumns: '36px minmax(180px, 1.5fr) 100px 80px 80px 80px 120px 80px 100px 100px 110px 70px', 
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
                      <div style={{ textAlign: 'right' }}>{(item.supply_qty ?? 0)}</div>
                      <div style={{ textAlign: 'right', color: '#3b82f6', fontWeight: 500 }}>{(item.received_qty ?? 0)}</div>
                      <div style={{ fontSize: '13px', color: '#6b7280' }}>{item.source_document || '-'}</div>
                      <div>{item.unit}</div>
                      <div style={{ textAlign: 'right' }}>{item.rate ? item.rate.toFixed(2) : '-'}</div>
                      <div style={{ textAlign: 'right', fontWeight: 500 }}>{item.rate ? ((item.planned_qty || 0) * item.rate).toFixed(2) : '-'}</div>
                      <div style={{ fontSize: '13px', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.remarks || '-'}
                      </div>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleEdit(item); }}
                          style={{ padding: '4px', border: 'none', background: 'transparent', color: '#3b82f6', cursor: 'pointer', borderRadius: '4px' }}
                          title="Edit"
                        >
                          <Edit size={15} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                          style={{ padding: '4px', border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', borderRadius: '4px' }}
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  )}
                  {expandedRows.has(item.id) && editingId !== item.id && (
                    <div style={{ padding: '12px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: '12px', color: '#6b7280', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                      <div>Material ID: <span style={{ fontFamily: 'monospace' }}>{item.item_id}</span></div>
                      <div>Variant ID: <span style={{ fontFamily: 'monospace' }}>{item.variant_id || '-'}</span></div>
                      <div>Created: {new Date(item.created_at).toLocaleDateString('en-GB')}</div>
                      <div>Updated: {new Date(item.updated_at).toLocaleDateString('en-GB')}</div>
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
              <div style={{ display: 'grid', gridTemplateColumns: '36px minmax(180px, 1.5fr) 100px 80px 80px 80px 120px 80px 100px 100px 110px 70px', gap: '16px', padding: '12px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                <div></div>
                <div>Material</div>
                <div>Variant</div>
                <div style={{ textAlign: 'right' }}>Planned Qty</div>
                <div style={{ textAlign: 'right' }}>Supply Qty</div>
                <div style={{ textAlign: 'right', color: '#3b82f6' }}>Received Qty</div>
                <div>Source Document</div>
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
                    <div style={{ display: 'grid', gridTemplateColumns: '36px minmax(180px, 1.5fr) 100px 80px 80px 80px 120px 80px 100px 100px 110px 70px', gap: '16px', padding: '12px 16px', borderBottom: '1px solid #f3f4f6', alignItems: 'center', fontSize: '14px' }}>
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
                          type="number"
                          step="0.01"
                          value={formData.supply_qty}
                          onChange={(e) => setFormData({ ...formData, supply_qty: e.target.value })}
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '13px', textAlign: 'right' }}
                        />
                      </div>
                      <div style={{ textAlign: 'right', padding: '6px 8px', color: '#3b82f6', fontWeight: 500 }}>
                        {item.received_qty ?? 0}
                      </div>
                      <div>
                        <input
                          type="text"
                          value={formData.source_document}
                          onChange={(e) => setFormData({ ...formData, source_document: e.target.value })}
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '13px' }}
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
                        gridTemplateColumns: '36px minmax(180px, 1.5fr) 100px 80px 80px 80px 120px 80px 100px 100px 110px 70px', 
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
                      <div style={{ textAlign: 'right' }}>{(item.supply_qty ?? 0)}</div>
                      <div style={{ textAlign: 'right', color: '#3b82f6', fontWeight: 500 }}>{(item.received_qty ?? 0)}</div>
                      <div style={{ fontSize: '13px', color: '#6b7280' }}>{item.source_document || '-'}</div>
                      <div>{item.unit}</div>
                      <div style={{ textAlign: 'right' }}>{item.rate ? item.rate.toFixed(2) : '-'}</div>
                      <div style={{ textAlign: 'right', fontWeight: 500 }}>{item.rate ? ((item.planned_qty || 0) * item.rate).toFixed(2) : '-'}</div>
                      <div style={{ fontSize: '13px', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.remarks || '-'}
                      </div>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleEdit(item); }}
                          style={{ padding: '4px', border: 'none', background: 'transparent', color: '#3b82f6', cursor: 'pointer', borderRadius: '4px' }}
                          title="Edit"
                        >
                          <Edit size={15} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                          style={{ padding: '4px', border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', borderRadius: '4px' }}
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  )}
                  {expandedRows.has(item.id) && editingId !== item.id && (
                    <div style={{ padding: '12px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: '12px', color: '#6b7280', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                      <div>Material ID: <span style={{ fontFamily: 'monospace' }}>{item.item_id}</span></div>
                      <div>Variant ID: <span style={{ fontFamily: 'monospace' }}>{item.variant_id || '-'}</span></div>
                      <div>Created: {new Date(item.created_at).toLocaleDateString('en-GB')}</div>
                      <div>Updated: {new Date(item.updated_at).toLocaleDateString('en-GB')}</div>
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
