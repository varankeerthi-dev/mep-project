import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Package, Tag, Building, X } from 'lucide-react';
import { toolsApi } from '../tools/api';
import { useAuth } from '../App';
import CategoryManager from '../components/tools/CategoryManager';
import WarehouseManager from '../components/tools/WarehouseManager';

const sectionHeadStyle: React.CSSProperties = {
  fontWeight: 600, fontSize: '11px', color: '#6b7280',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px'
};

const labelStyle: React.CSSProperties = {
  fontWeight: 600, fontSize: '11px', color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em'
};

const inputStyle: React.CSSProperties = {
  width: '100%', height: '36px', padding: '0 10px', fontSize: '12px',
  border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff',
  color: '#18181b', outline: 'none', boxSizing: 'border-box'
};

const primaryBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '4px',
  padding: '6px 14px', background: '#185FA5',
  border: '1px solid #185FA5', color: '#fff',
  borderRadius: '6px', fontSize: '12px', fontWeight: 500,
  cursor: 'pointer', transition: 'all 0.15s'
};

const secondaryBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px',
  padding: '6px 12px', background: '#fff',
  border: '1px solid #d1d5db', color: '#374151',
  borderRadius: '6px', fontSize: '12px', fontWeight: 500,
  cursor: 'pointer', transition: 'all 0.15s'
};

const destructiveBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '4px',
  padding: '6px 12px', border: '1px solid #d1d5db',
  background: '#fff', color: '#000',
  borderRadius: '6px', fontSize: '12px', fontWeight: 500,
  cursor: 'pointer', transition: 'all 0.15s'
};

function ToolForm({ tool, onSubmit, onCancel }: { tool: any; onSubmit: (data: any) => void; onCancel: () => void }) {
  const [formData, setFormData] = useState({
    tool_name: '', make: '', model: '', category: '',
    purchase_price: '', gst_rate: '', depreciation_rate: '',
    technical_specs: '',
    custom_label_1_name: '', custom_label_1_value: '',
    custom_label_2_name: '', custom_label_2_value: '',
    custom_label_3_name: '', custom_label_3_value: '',
    custom_label_4_name: '', custom_label_4_value: '',
    initial_stock: 0, min_stock_level: 0, reorder_point: 0,
    default_source_location: 'Warehouse', hsn_code: '',
  });

  useEffect(() => { if (tool) setFormData(tool); }, [tool]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      purchase_price: parseFloat(formData.purchase_price) || 0,
      gst_rate: parseFloat(formData.gst_rate) || 0,
      depreciation_rate: parseFloat(formData.depreciation_rate) || 0,
      initial_stock: parseInt(formData.initial_stock.toString()) || 0,
      min_stock_level: parseInt(formData.min_stock_level.toString()) || 0,
      reorder_point: parseInt(formData.reorder_point.toString()) || 0,
    });
  };

  const update = (field: string, value: any) => setFormData(prev => ({ ...prev, [field]: value }));

  return (
    <form onSubmit={handleSubmit} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#18181b', margin: 0 }}>{tool ? 'Edit Tool' : 'Add New Tool'}</h2>
        <button type="button" onClick={onCancel} style={{ width: '28px', height: '28px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71717a' }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ flex: 1, padding: '24px', background: '#f9fafb', overflowY: 'auto' }}>
        <div style={{ marginBottom: '20px' }}>
          <div style={sectionHeadStyle}>Basic Information</div>
          <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '6px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <div style={labelStyle}>Tool Name</div>
                <input type="text" value={formData.tool_name} onChange={e => update('tool_name', e.target.value)} required style={inputStyle} />
              </div>
              <div>
                <div style={labelStyle}>Category</div>
                <select value={formData.category} onChange={e => update('category', e.target.value)} required style={inputStyle}>
                  <option value="">Select Category</option>
                  <option value="Power Tools">Power Tools</option>
                  <option value="Hand Tools">Hand Tools</option>
                  <option value="Measuring Tools">Measuring Tools</option>
                  <option value="Safety Equipment">Safety Equipment</option>
                  <option value="Welding Equipment">Welding Equipment</option>
                  <option value="Electrical Tools">Electrical Tools</option>
                  <option value="Cutting Tools">Cutting Tools</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <div style={labelStyle}>Make</div>
                <input type="text" value={formData.make} onChange={e => update('make', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <div style={labelStyle}>Model/Spec</div>
                <input type="text" value={formData.model} onChange={e => update('model', e.target.value)} style={inputStyle} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div style={sectionHeadStyle}>Financial Information</div>
          <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '6px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <div style={labelStyle}>Purchase Price</div>
                <input type="number" value={formData.purchase_price} onChange={e => update('purchase_price', e.target.value)} step="0.01" style={inputStyle} />
              </div>
              <div>
                <div style={labelStyle}>GST Rate (%)</div>
                <input type="number" value={formData.gst_rate} onChange={e => update('gst_rate', e.target.value)} step="0.01" style={inputStyle} />
              </div>
              <div>
                <div style={labelStyle}>Depreciation Rate (%)</div>
                <input type="number" value={formData.depreciation_rate} onChange={e => update('depreciation_rate', e.target.value)} step="0.01" style={inputStyle} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div style={sectionHeadStyle}>Stock Information</div>
          <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '6px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <div style={labelStyle}>Initial Stock</div>
                <input type="number" value={formData.initial_stock} onChange={e => update('initial_stock', parseInt(e.target.value) || 0)} style={inputStyle} />
              </div>
              <div>
                <div style={labelStyle}>Min Stock Level</div>
                <input type="number" value={formData.min_stock_level} onChange={e => update('min_stock_level', parseInt(e.target.value) || 0)} style={inputStyle} />
              </div>
              <div>
                <div style={labelStyle}>Reorder Point</div>
                <input type="number" value={formData.reorder_point} onChange={e => update('reorder_point', parseInt(e.target.value) || 0)} style={inputStyle} />
              </div>
            </div>
            <div style={{ marginTop: '12px' }}>
              <div style={labelStyle}>Default Source Location</div>
              <select value={formData.default_source_location} onChange={e => update('default_source_location', e.target.value)} style={{ ...inputStyle, maxWidth: '300px' }}>
                <option value="Warehouse">Warehouse</option>
                <option value="Main Office">Main Office</option>
                <option value="Central Store">Central Store</option>
                <option value="Regional Hub">Regional Hub</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', background: '#f9fafb', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button type="button" onClick={onCancel} style={secondaryBtn}
          onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
        >Cancel</button>
        <button type="submit" style={primaryBtn}
          onMouseEnter={e => { e.currentTarget.style.background = '#0C447C'; e.currentTarget.style.borderColor = '#0C447C'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#185FA5'; e.currentTarget.style.borderColor = '#185FA5'; }}
        >{tool ? 'Update Tool' : 'Create Tool'}</button>
      </div>
    </form>
  );
}

export default function ToolsCatalog() {
  const { organisation } = useAuth();
  const [tools, setTools] = useState<any[]>([]);
  const [filteredTools, setFilteredTools] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTool, setSelectedTool] = useState<any>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isWarehouseManagerOpen, setIsWarehouseManagerOpen] = useState(false);

  useEffect(() => { if (organisation?.id) loadTools(); }, [organisation]);

  useEffect(() => {
    const filtered = tools.filter(tool =>
      tool.tool_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tool.make?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tool.category?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredTools(filtered);
  }, [searchTerm, tools]);

  const loadTools = async () => {
    try {
      setLoading(true);
      const toolsData = await toolsApi.getTools(organisation.id);
      setTools(toolsData);
      setFilteredTools(toolsData);
    } catch (error) {
      console.error('Error loading tools:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTool = () => { setSelectedTool(null); setIsCreateModalOpen(true); };
  const handleEditTool = (tool: any) => { setSelectedTool(tool); setIsEditModalOpen(true); };

  const handleDeleteTool = async (toolId: string) => {
    if (window.confirm('Are you sure you want to delete this tool?')) {
      try {
        await toolsApi.deleteTool(organisation.id, toolId);
        loadTools();
      } catch (error) {
        console.error('Error deleting tool:', error);
      }
    }
  };

  const getStockStatus = (currentStock: number, minStock: number) => {
    if (currentStock === 0) return { status: 'OUT OF STOCK', color: '#dc2626' };
    if (currentStock <= minStock) return { status: 'LOW STOCK', color: '#d97706' };
    return { status: 'IN STOCK', color: '#059669' };
  };

  if (loading) {
    return (
      <div className="p-6 space-y-3 animate-pulse">
        {[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-zinc-100 rounded-md" />)}
      </div>
    );
  }

  return (
    <div className="p-6" style={{ fontFamily: "'Geist Variable', 'Inter', system-ui, sans-serif" }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#18181b', margin: '0 0 4px', letterSpacing: '-0.01em' }}>Tools Catalog</h1>
        <p style={{ fontSize: '13px', color: '#71717a', margin: 0 }}>Manage your tools inventory and track stock levels</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input type="text" placeholder="Search tools..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', paddingLeft: '32px', paddingRight: '10px', height: '34px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', color: '#18181b', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" style={secondaryBtn} onClick={() => setIsCategoryManagerOpen(true)}
            onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
          ><Tag size={13} /> Manage Categories</button>
          <button type="button" style={secondaryBtn} onClick={() => setIsWarehouseManagerOpen(true)}
            onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
          ><Building size={13} /> Manage Warehouses</button>
          <button type="button" style={primaryBtn} onClick={handleCreateTool}
            onMouseEnter={e => { e.currentTarget.style.background = '#0C447C'; e.currentTarget.style.borderColor = '#0C447C'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#185FA5'; e.currentTarget.style.borderColor = '#185FA5'; }}
          ><Plus size={13} /> Add Tool</button>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: '#1e3a8a' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#fff', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Tool Name</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#fff', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Make</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#fff', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Model/Spec</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#fff', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Category</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#fff', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Current Stock</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#fff', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Status</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', color: '#fff', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTools.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: '#9ca3af' }}>
                  <Package size={48} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
                  <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>No tools found</div>
                  <div style={{ fontSize: '12px' }}>Add your first tool to get started</div>
                </td>
              </tr>
            ) : (
              filteredTools.map((tool, idx) => {
                const stockStatus = getStockStatus(tool.current_stock || 0, tool.min_stock_level || 0);
                return (
                  <tr key={tool.id} style={{ borderBottom: '1px solid #f3f4f6', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '10px 12px', color: '#18181b', fontWeight: 500 }}>{tool.tool_name}</td>
                    <td style={{ padding: '10px 12px', color: '#71717a' }}>{tool.make}</td>
                    <td style={{ padding: '10px 12px', color: '#71717a' }}>{tool.model}</td>
                    <td style={{ padding: '10px 12px', color: '#71717a' }}><span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: '#f3f4f6', color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{tool.category}</span></td>
                    <td style={{ padding: '10px 12px', color: '#18181b', fontWeight: 600 }}>{tool.current_stock || 0}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: stockStatus.color + '15', color: stockStatus.color }}>{stockStatus.status}</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button type="button" title="Edit" style={{ padding: '4px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#374151', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
                          onClick={() => handleEditTool(tool)}><Edit2 size={12} /></button>
                        <button type="button" title="Delete" style={{ padding: '4px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#000', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
                          onClick={() => handleDeleteTool(tool.id)}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {isCreateModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '640px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <ToolForm tool={null} onSubmit={async (data) => { try { await toolsApi.createTool(organisation.id, data); loadTools(); setIsCreateModalOpen(false); } catch (error) { console.error('Error creating tool:', error); } }} onCancel={() => setIsCreateModalOpen(false)} />
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '640px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <ToolForm tool={selectedTool} onSubmit={async (data) => { try { await toolsApi.updateTool(organisation.id, selectedTool.id, data); loadTools(); setIsEditModalOpen(false); } catch (error) { console.error('Error updating tool:', error); } }} onCancel={() => setIsEditModalOpen(false)} />
          </div>
        </div>
      )}

      <CategoryManager isOpen={isCategoryManagerOpen} onClose={() => setIsCategoryManagerOpen(false)} organisation={organisation} />
      <WarehouseManager isOpen={isWarehouseManagerOpen} onClose={() => setIsWarehouseManagerOpen(false)} organisation={organisation} />
    </div>
  );
}
