import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Package, AlertTriangle, ArrowUpDown, X } from 'lucide-react';
import { toolsApi } from '../tools/api';
import { useAuth } from '../App';

// Professional Modal Design System Tokens
const DESIGN_TOKENS = {
  colors: {
    surface: {
      card: '#FFFFFF',
      page: '#F8F9FA',
    },
    border: '#E5E7EB',
    accent: '#DC2626',
    text: {
      primary: '#111827',
      secondary: '#6B7280',
      muted: '#9CA3AF',
    }
  },
  typography: {
    title: '1.125rem', // 18px
    label: '0.75rem',   // 12px
    input: '0.875rem',  // 14px
    button: '0.875rem', // 14px
    monospace: '0.8125rem', // 13px
  },
  spacing: {
    container: {
      standard: '640px',
      dataRich: '800px',
      dashboard: '1100px',
    },
    padding: {
      main: '1.25rem', // 20px
    },
    gap: {
      form: '1rem',      // 16px
      label: '0.375rem', // 6px
    }
  },
  borderRadius: {
    subtle: '0.375rem', // 6px
    none: '0px',
  },
  blur: {
    overlay: 'blur(2px)',
  }
};

// Tool Form Component
interface ToolFormProps {
  tool: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

function ToolForm({ tool, onSubmit, onCancel }: ToolFormProps) {
  const [formData, setFormData] = useState({
    tool_name: '',
    make: '',
    model: '',
    category: '',
    purchase_price: '',
    gst_rate: '',
    depreciation_rate: '',
    technical_specs: '',
    custom_label_1_name: '',
    custom_label_1_value: '',
    custom_label_2_name: '',
    custom_label_2_value: '',
    custom_label_3_name: '',
    custom_label_3_value: '',
    custom_label_4_name: '',
    custom_label_4_value: '',
    initial_stock: 0,
    min_stock_level: 0,
    reorder_point: 0,
    default_source_location: 'Warehouse',
    hsn_code: '',
  });

  useEffect(() => {
    if (tool) {
      setFormData(tool);
    }
  }, [tool]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Convert string values to numbers for numeric fields
    const toolData = {
      ...formData,
      purchase_price: parseFloat(formData.purchase_price) || 0,
      gst_rate: parseFloat(formData.gst_rate) || 0,
      depreciation_rate: parseFloat(formData.depreciation_rate) || 0,
      initial_stock: parseInt(formData.initial_stock.toString()) || 0,
      min_stock_level: parseInt(formData.min_stock_level.toString()) || 0,
      reorder_point: parseInt(formData.reorder_point.toString()) || 0,
    };
    
    onSubmit(toolData);
  };

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Modal Header */}
      <div
        style={{
          height: '64px',
          backgroundColor: DESIGN_TOKENS.colors.surface.card,
          borderBottom: `1px solid ${DESIGN_TOKENS.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `0 ${DESIGN_TOKENS.spacing.padding.main}px`,
        }}
      >
        <h2
          style={{
            fontSize: DESIGN_TOKENS.typography.title,
            fontWeight: 600,
            color: DESIGN_TOKENS.colors.text.primary,
            margin: 0,
          }}
        >
          {tool ? 'Edit Tool' : 'Add New Tool'}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          style={{
            width: '32px',
            height: '32px',
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: DESIGN_TOKENS.borderRadius.none,
          }}
        >
          <X size={20} color={DESIGN_TOKENS.colors.text.secondary} />
        </button>
      </div>

      {/* Modal Body */}
      <div
        style={{
          flex: 1,
          padding: DESIGN_TOKENS.spacing.padding.main,
          backgroundColor: DESIGN_TOKENS.colors.surface.page,
          overflowY: 'auto',
        }}
      >
        {/* Basic Information */}
        <div style={{ marginBottom: DESIGN_TOKENS.spacing.gap.form }}>
          <h3
            style={{
              fontSize: DESIGN_TOKENS.typography.label,
              fontWeight: 600,
              color: DESIGN_TOKENS.colors.text.primary,
              marginBottom: DESIGN_TOKENS.spacing.gap.label,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            BASIC INFORMATION
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: DESIGN_TOKENS.spacing.gap.form }}>
            <div>
              <div
                style={{
                  fontSize: DESIGN_TOKENS.typography.label,
                  fontWeight: 600,
                  color: DESIGN_TOKENS.colors.text.primary,
                  marginBottom: DESIGN_TOKENS.spacing.gap.label,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                TOOL NAME
              </div>
              <input
                type="text"
                value={formData.tool_name}
                onChange={(e) => updateFormData('tool_name', e.target.value)}
                required
                style={{
                  width: '100%',
                  height: '38px',
                  backgroundColor: DESIGN_TOKENS.colors.surface.card,
                  border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                  borderRadius: DESIGN_TOKENS.borderRadius.none,
                  fontSize: DESIGN_TOKENS.typography.input,
                  color: DESIGN_TOKENS.colors.text.primary,
                  padding: '0 12px',
                }}
              />
            </div>
            <div>
              <div
                style={{
                  fontSize: DESIGN_TOKENS.typography.label,
                  fontWeight: 600,
                  color: DESIGN_TOKENS.colors.text.primary,
                  marginBottom: DESIGN_TOKENS.spacing.gap.label,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                CATEGORY
              </div>
              <select
                value={formData.category}
                onChange={(e) => updateFormData('category', e.target.value)}
                required
                style={{
                  width: '100%',
                  height: '38px',
                  backgroundColor: DESIGN_TOKENS.colors.surface.card,
                  border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                  borderRadius: DESIGN_TOKENS.borderRadius.none,
                  fontSize: DESIGN_TOKENS.typography.input,
                  color: DESIGN_TOKENS.colors.text.primary,
                  padding: '0 12px',
                }}
              >
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
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: DESIGN_TOKENS.spacing.gap.form, marginTop: DESIGN_TOKENS.spacing.gap.form }}>
            <div>
              <div
                style={{
                  fontSize: DESIGN_TOKENS.typography.label,
                  fontWeight: 600,
                  color: DESIGN_TOKENS.colors.text.primary,
                  marginBottom: DESIGN_TOKENS.spacing.gap.label,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                MAKE
              </div>
              <input
                type="text"
                value={formData.make}
                onChange={(e) => updateFormData('make', e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  backgroundColor: DESIGN_TOKENS.colors.surface.card,
                  border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                  borderRadius: DESIGN_TOKENS.borderRadius.none,
                  fontSize: DESIGN_TOKENS.typography.input,
                  color: DESIGN_TOKENS.colors.text.primary,
                  padding: '0 12px',
                }}
              />
            </div>
            <div>
              <div
                style={{
                  fontSize: DESIGN_TOKENS.typography.label,
                  fontWeight: 600,
                  color: DESIGN_TOKENS.colors.text.primary,
                  marginBottom: DESIGN_TOKENS.spacing.gap.label,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                MODEL/Spec
              </div>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => updateFormData('model', e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  backgroundColor: DESIGN_TOKENS.colors.surface.card,
                  border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                  borderRadius: DESIGN_TOKENS.borderRadius.none,
                  fontSize: DESIGN_TOKENS.typography.input,
                  color: DESIGN_TOKENS.colors.text.primary,
                  padding: '0 12px',
                }}
              />
            </div>
          </div>
        </div>

        {/* Financial Information */}
        <div style={{ marginBottom: DESIGN_TOKENS.spacing.gap.form }}>
          <h3
            style={{
              fontSize: DESIGN_TOKENS.typography.label,
              fontWeight: 600,
              color: DESIGN_TOKENS.colors.text.primary,
              marginBottom: DESIGN_TOKENS.spacing.gap.label,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            FINANCIAL INFORMATION
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: DESIGN_TOKENS.spacing.gap.form }}>
            <div>
              <div
                style={{
                  fontSize: DESIGN_TOKENS.typography.label,
                  fontWeight: 600,
                  color: DESIGN_TOKENS.colors.text.primary,
                  marginBottom: DESIGN_TOKENS.spacing.gap.label,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                PURCHASE PRICE
              </div>
              <input
                type="number"
                value={formData.purchase_price}
                onChange={(e) => updateFormData('purchase_price', e.target.value)}
                step="0.01"
                style={{
                  width: '100%',
                  height: '38px',
                  backgroundColor: DESIGN_TOKENS.colors.surface.card,
                  border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                  borderRadius: DESIGN_TOKENS.borderRadius.none,
                  fontSize: DESIGN_TOKENS.typography.input,
                  color: DESIGN_TOKENS.colors.text.primary,
                  padding: '0 12px',
                }}
              />
            </div>
            <div>
              <div
                style={{
                  fontSize: DESIGN_TOKENS.typography.label,
                  fontWeight: 600,
                  color: DESIGN_TOKENS.colors.text.primary,
                  marginBottom: DESIGN_TOKENS.spacing.gap.label,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                GST RATE
              </div>
              <input
                type="number"
                value={formData.gst_rate}
                onChange={(e) => updateFormData('gst_rate', e.target.value)}
                step="0.01"
                style={{
                  width: '100%',
                  height: '38px',
                  backgroundColor: DESIGN_TOKENS.colors.surface.card,
                  border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                  borderRadius: DESIGN_TOKENS.borderRadius.none,
                  fontSize: DESIGN_TOKENS.typography.input,
                  color: DESIGN_TOKENS.colors.text.primary,
                  padding: '0 12px',
                }}
              />
            </div>
            <div>
              <div
                style={{
                  fontSize: DESIGN_TOKENS.typography.label,
                  fontWeight: 600,
                  color: DESIGN_TOKENS.colors.text.primary,
                  marginBottom: DESIGN_TOKENS.spacing.gap.label,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                DEPRECIATION RATE
              </div>
              <input
                type="number"
                value={formData.depreciation_rate}
                onChange={(e) => updateFormData('depreciation_rate', e.target.value)}
                step="0.01"
                style={{
                  width: '100%',
                  height: '38px',
                  backgroundColor: DESIGN_TOKENS.colors.surface.card,
                  border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                  borderRadius: DESIGN_TOKENS.borderRadius.none,
                  fontSize: DESIGN_TOKENS.typography.input,
                  color: DESIGN_TOKENS.colors.text.primary,
                  padding: '0 12px',
                }}
              />
            </div>
          </div>
        </div>

        {/* Stock Information */}
        <div style={{ marginBottom: DESIGN_TOKENS.spacing.gap.form }}>
          <h3
            style={{
              fontSize: DESIGN_TOKENS.typography.label,
              fontWeight: 600,
              color: DESIGN_TOKENS.colors.text.primary,
              marginBottom: DESIGN_TOKENS.spacing.gap.label,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            STOCK INFORMATION
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: DESIGN_TOKENS.spacing.gap.form }}>
            <div>
              <div
                style={{
                  fontSize: DESIGN_TOKENS.typography.label,
                  fontWeight: 600,
                  color: DESIGN_TOKENS.colors.text.primary,
                  marginBottom: DESIGN_TOKENS.spacing.gap.label,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                INITIAL STOCK
              </div>
              <input
                type="number"
                value={formData.initial_stock}
                onChange={(e) => updateFormData('initial_stock', parseInt(e.target.value) || 0)}
                style={{
                  width: '100%',
                  height: '38px',
                  backgroundColor: DESIGN_TOKENS.colors.surface.card,
                  border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                  borderRadius: DESIGN_TOKENS.borderRadius.none,
                  fontSize: DESIGN_TOKENS.typography.input,
                  color: DESIGN_TOKENS.colors.text.primary,
                  padding: '0 12px',
                }}
              />
            </div>
            <div>
              <div
                style={{
                  fontSize: DESIGN_TOKENS.typography.label,
                  fontWeight: 600,
                  color: DESIGN_TOKENS.colors.text.primary,
                  marginBottom: DESIGN_TOKENS.spacing.gap.label,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                MIN STOCK LEVEL
              </div>
              <input
                type="number"
                value={formData.min_stock_level}
                onChange={(e) => updateFormData('min_stock_level', parseInt(e.target.value) || 0)}
                style={{
                  width: '100%',
                  height: '38px',
                  backgroundColor: DESIGN_TOKENS.colors.surface.card,
                  border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                  borderRadius: DESIGN_TOKENS.borderRadius.none,
                  fontSize: DESIGN_TOKENS.typography.input,
                  color: DESIGN_TOKENS.colors.text.primary,
                  padding: '0 12px',
                }}
              />
            </div>
            <div>
              <div
                style={{
                  fontSize: DESIGN_TOKENS.typography.label,
                  fontWeight: 600,
                  color: DESIGN_TOKENS.colors.text.primary,
                  marginBottom: DESIGN_TOKENS.spacing.gap.label,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                REORDER POINT
              </div>
              <input
                type="number"
                value={formData.reorder_point}
                onChange={(e) => updateFormData('reorder_point', parseInt(e.target.value) || 0)}
                style={{
                  width: '100%',
                  height: '38px',
                  backgroundColor: DESIGN_TOKENS.colors.surface.card,
                  border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                  borderRadius: DESIGN_TOKENS.borderRadius.none,
                  fontSize: DESIGN_TOKENS.typography.input,
                  color: DESIGN_TOKENS.colors.text.primary,
                  padding: '0 12px',
                }}
              />
            </div>
          </div>
          <div style={{ marginTop: DESIGN_TOKENS.spacing.gap.form }}>
            <div
              style={{
                fontSize: DESIGN_TOKENS.typography.label,
                fontWeight: 600,
                color: DESIGN_TOKENS.colors.text.primary,
                marginBottom: DESIGN_TOKENS.spacing.gap.label,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              DEFAULT SOURCE LOCATION
            </div>
            <select
              value={formData.default_source_location}
              onChange={(e) => updateFormData('default_source_location', e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                backgroundColor: DESIGN_TOKENS.colors.surface.card,
                border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                borderRadius: DESIGN_TOKENS.borderRadius.none,
                fontSize: DESIGN_TOKENS.typography.input,
                color: DESIGN_TOKENS.colors.text.primary,
                padding: '0 12px',
              }}
            >
              <option value="Warehouse">Warehouse</option>
              <option value="Main Office">Main Office</option>
              <option value="Central Store">Central Store</option>
              <option value="Regional Hub">Regional Hub</option>
            </select>
          </div>
        </div>
      </div>

      {/* Modal Footer */}
      <div
        style={{
          height: '64px',
          backgroundColor: DESIGN_TOKENS.colors.surface.page,
          borderTop: `1px solid ${DESIGN_TOKENS.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: `0 ${DESIGN_TOKENS.spacing.padding.main}px`,
          gap: '12px',
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '10px 20px',
            backgroundColor: 'transparent',
            border: `1px solid ${DESIGN_TOKENS.colors.border}`,
            borderRadius: DESIGN_TOKENS.borderRadius.none,
            fontSize: DESIGN_TOKENS.typography.button,
            fontWeight: 600,
            color: DESIGN_TOKENS.colors.text.secondary,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          style={{
            padding: '10px 20px',
            backgroundColor: DESIGN_TOKENS.colors.accent,
            border: 'none',
            borderRadius: DESIGN_TOKENS.borderRadius.none,
            fontSize: DESIGN_TOKENS.typography.button,
            fontWeight: 600,
            color: '#FFFFFF',
            cursor: 'pointer',
          }}
        >
          {tool ? 'Update Tool' : 'Create Tool'}
        </button>
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

  useEffect(() => {
    if (organisation?.id) {
      loadTools();
    }
  }, [organisation]);

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

  const handleCreateTool = () => {
    setSelectedTool(null);
    setIsCreateModalOpen(true);
  };

  const handleEditTool = (tool: any) => {
    setSelectedTool(tool);
    setIsEditModalOpen(true);
  };

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
    if (currentStock === 0) return { status: 'OUT OF STOCK', color: 'text-red-600' };
    if (currentStock <= minStock) return { status: 'LOW STOCK', color: 'text-orange-600' };
    return { status: 'IN STOCK', color: 'text-green-600' };
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: DESIGN_TOKENS.spacing.padding.main }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: DESIGN_TOKENS.colors.text.primary, margin: '0 0 8px' }}>
          Tools Catalog
        </h1>
        <p style={{ fontSize: DESIGN_TOKENS.typography.input, color: DESIGN_TOKENS.colors.text.secondary, margin: 0 }}>
          Manage your tools inventory and track stock levels
        </p>
      </div>

      {/* Actions Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: DESIGN_TOKENS.colors.text.muted }} />
          <input
            type="text"
            placeholder="Search tools..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: '40px',
              paddingRight: '12px',
              height: '40px',
              border: `1px solid ${DESIGN_TOKENS.colors.border}`,
              borderRadius: DESIGN_TOKENS.borderRadius.subtle,
              fontSize: DESIGN_TOKENS.typography.input,
              color: DESIGN_TOKENS.colors.text.primary,
            }}
          />
        </div>
        <button
          onClick={handleCreateTool}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            backgroundColor: DESIGN_TOKENS.colors.accent,
            border: 'none',
            borderRadius: DESIGN_TOKENS.borderRadius.subtle,
            fontSize: DESIGN_TOKENS.typography.button,
            fontWeight: 600,
            color: '#FFFFFF',
            cursor: 'pointer',
          }}
        >
          <Plus size={16} />
          Add Tool
        </button>
      </div>

      {/* Tools Table */}
      <div style={{ backgroundColor: DESIGN_TOKENS.colors.surface.card, borderRadius: DESIGN_TOKENS.borderRadius.subtle, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: DESIGN_TOKENS.colors.surface.page }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: DESIGN_TOKENS.typography.label, fontWeight: 600, color: DESIGN_TOKENS.colors.text.secondary }}>Tool Name</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: DESIGN_TOKENS.typography.label, fontWeight: 600, color: DESIGN_TOKENS.colors.text.secondary }}>Make</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: DESIGN_TOKENS.typography.label, fontWeight: 600, color: DESIGN_TOKENS.colors.text.secondary }}>MODEL/Spec</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: DESIGN_TOKENS.typography.label, fontWeight: 600, color: DESIGN_TOKENS.colors.text.secondary }}>Category</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: DESIGN_TOKENS.typography.label, fontWeight: 600, color: DESIGN_TOKENS.colors.text.secondary }}>Current Stock</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: DESIGN_TOKENS.typography.label, fontWeight: 600, color: DESIGN_TOKENS.colors.text.secondary }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: DESIGN_TOKENS.typography.label, fontWeight: 600, color: DESIGN_TOKENS.colors.text.secondary }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTools.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: DESIGN_TOKENS.colors.text.muted }}>
                  <Package size={48} style={{ margin: '0 auto 16px', display: 'block' }} />
                  <div style={{ fontSize: '16px', marginBottom: '8px' }}>No tools found</div>
                  <div style={{ fontSize: DESIGN_TOKENS.typography.input }}>Add your first tool to get started</div>
                </td>
              </tr>
            ) : (
              filteredTools.map((tool) => {
                const stockStatus = getStockStatus(tool.current_stock || 0, tool.min_stock_level || 0);
                return (
                  <tr key={tool.id} style={{ borderBottom: `1px solid ${DESIGN_TOKENS.colors.border}` }}>
                    <td style={{ padding: '16px', fontSize: DESIGN_TOKENS.typography.input, color: DESIGN_TOKENS.colors.text.primary }}>
                      {tool.tool_name}
                    </td>
                    <td style={{ padding: '16px', fontSize: DESIGN_TOKENS.typography.input, color: DESIGN_TOKENS.colors.text.secondary }}>
                      {tool.make}
                    </td>
                    <td style={{ padding: '16px', fontSize: DESIGN_TOKENS.typography.input, color: DESIGN_TOKENS.colors.text.secondary }}>
                      {tool.model}
                    </td>
                    <td style={{ padding: '16px', fontSize: DESIGN_TOKENS.typography.input, color: DESIGN_TOKENS.colors.text.secondary }}>
                      {tool.category}
                    </td>
                    <td style={{ padding: '16px', fontSize: DESIGN_TOKENS.typography.input, color: DESIGN_TOKENS.colors.text.primary }}>
                      {tool.current_stock || 0}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span style={{ 
                        fontSize: DESIGN_TOKENS.typography.label, 
                        fontWeight: 600, 
                        color: stockStatus.color 
                      }}>
                        {stockStatus.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleEditTool(tool)}
                          style={{
                            padding: '6px',
                            backgroundColor: 'transparent',
                            border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                            borderRadius: DESIGN_TOKENS.borderRadius.subtle,
                            cursor: 'pointer',
                            color: DESIGN_TOKENS.colors.text.secondary,
                          }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteTool(tool.id)}
                          style={{
                            padding: '6px',
                            backgroundColor: 'transparent',
                            border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                            borderRadius: DESIGN_TOKENS.borderRadius.subtle,
                            cursor: 'pointer',
                            color: DESIGN_TOKENS.colors.accent,
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {isCreateModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: DESIGN_TOKENS.colors.surface.card,
            borderRadius: DESIGN_TOKENS.borderRadius.subtle,
            width: '600px',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            <ToolForm
              tool={null}
              onSubmit={async (data) => {
                try {
                  await toolsApi.createTool(organisation.id, data);
                  loadTools();
                  setIsCreateModalOpen(false);
                } catch (error) {
                  console.error('Error creating tool:', error);
                }
              }}
              onCancel={() => setIsCreateModalOpen(false)}
            />
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: DESIGN_TOKENS.colors.surface.card,
            borderRadius: DESIGN_TOKENS.borderRadius.subtle,
            width: '600px',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            <ToolForm
              tool={selectedTool}
              onSubmit={async (data) => {
                try {
                  await toolsApi.updateTool(organisation.id, selectedTool.id, data);
                  loadTools();
                  setIsEditModalOpen(false);
                } catch (error) {
                  console.error('Error updating tool:', error);
                }
              }}
              onCancel={() => setIsEditModalOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}