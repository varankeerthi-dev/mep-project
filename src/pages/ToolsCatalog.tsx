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
        loadTools(); // Reload the list
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tools Catalog</h1>
            <p className="text-gray-600">Manage your tool inventory and specifications</p>
          </div>
          <button
            onClick={handleCreateTool}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Add New Tool
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search tools by name, make, or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Tools Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tool Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Make</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Min Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTools.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium text-gray-900 mb-2">No tools found</p>
                    <p className="text-sm">Create your first tool to get started</p>
                  </td>
                </tr>
              ) : (
                filteredTools.map((tool) => {
                  const stockStatus = getStockStatus(tool.current_stock || 0, tool.min_stock_level || 0);
                  return (
                    <tr key={tool.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <Package className="h-4 w-4 mr-3 text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-900">{tool.tool_name}</p>
                            {tool.model && (
                              <p className="text-sm text-gray-500">Model: {tool.model}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-900">{tool.make || '-'}</td>
                      <td className="px-6 py-4 text-gray-900">{tool.category || '-'}</td>
                      <td className="px-6 py-4 text-gray-900">{tool.current_stock || 0}</td>
                      <td className="px-6 py-4 text-gray-900">{tool.min_stock_level || 0}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${stockStatus.color}`}>
                          {stockStatus.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleEditTool(tool)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteTool(tool.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
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
      </div>

      {/* Low Stock Alert */}
      {tools.some(tool => (tool.current_stock || 0) <= (tool.min_stock_level || 0)) && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mt-6">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-orange-600 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-orange-800">Low Stock Alert</h3>
              <p className="text-sm text-orange-700">
                {tools.filter(tool => (tool.current_stock || 0) <= (tool.min_stock_level || 0)).length} tools are at or below minimum stock level. Consider reordering.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(isCreateModalOpen || isEditModalOpen) && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: DESIGN_TOKENS.spacing.container.dataRich,
              backgroundColor: DESIGN_TOKENS.colors.surface.card,
              borderRadius: DESIGN_TOKENS.borderRadius.subtle,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                height: '56px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: `0 ${DESIGN_TOKENS.spacing.padding.main}px`,
                borderBottom: `1px solid ${DESIGN_TOKENS.colors.border}`,
              }}
            >
              <h2
                style={{
                  fontSize: DESIGN_TOKENS.typography.title,
                  fontWeight: 700,
                  color: DESIGN_TOKENS.colors.text.primary,
                  margin: 0,
                  textTransform: 'sentence-case',
                }}
              >
                {isCreateModalOpen ? 'Create New Tool' : 'Edit Tool'}
              </h2>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setIsEditModalOpen(false);
                  setSelectedTool(null);
                }}
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

            {/* Modal Content */}
            <ToolForm
              tool={selectedTool}
              onSubmit={async (toolData) => {
                try {
                  if (isCreateModalOpen) {

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
      initial_stock: parseInt(formData.initial_stock) || 0,
      min_stock_level: parseInt(formData.min_stock_level) || 0,
      reorder_point: parseInt(formData.reorder_point) || 0,
      gst_rate: parseFloat(formData.gst_rate) || 0,
      purchase_price: parseFloat(formData.purchase_price) || 0,
      depreciation_rate: parseFloat(formData.depreciation_rate) || 0,
    };
    
    try {
      if (tool) {
        // Update existing tool
        await toolsApi.updateTool(organisation.id, tool.id, toolData);
      } else {
        // Create new tool
        await toolsApi.createTool(organisation.id, toolData);
      }
      
      setIsCreateModalOpen(false);
      setIsEditModalOpen(false);
      setSelectedTool(null);
      setFormData({
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
      
      if (tool) {
        loadTools(); // Reload the list
      }
    } catch (error) {
      console.error('Error saving tool:', error);
    }
  };

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} style={{ padding: DESIGN_TOKENS.spacing.padding.main }}>
      <div style={{ marginBottom: DESIGN_TOKENS.spacing.gap.form }}>
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
          BASIC INFORMATION
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: DESIGN_TOKENS.spacing.gap.form, marginBottom: DESIGN_TOKENS.spacing.gap.form }}>
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
              TOOL NAME *
            </div>
            <input
              type="text"
              value={formData.tool_name}
              onChange={(e) => updateFormData('tool_name', e.target.value)}
              required
              style={{
                width: '100%',
                height: '38px',
                backgroundColor: DESIGN_TOKENS.colors.surface.page,
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
              MAKE
            </div>
            <input
              type="text"
              value={formData.make}
              onChange={(e) => updateFormData('make', e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                backgroundColor: DESIGN_TOKENS.colors.surface.page,
                border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                borderRadius: DESIGN_TOKENS.borderRadius.none,
                fontSize: DESIGN_TOKENS.typography.input,
                color: DESIGN_TOKENS.colors.text.primary,
                padding: '0 12px',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: DESIGN_TOKENS.spacing.gap.form, marginBottom: DESIGN_TOKENS.spacing.gap.form }}>
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
              MODEL
            </div>
            <input
              type="text"
              value={formData.model}
              onChange={(e) => updateFormData('model', e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                backgroundColor: DESIGN_TOKENS.colors.surface.page,
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
            <input
              type="text"
              value={formData.category}
              onChange={(e) => updateFormData('category', e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                backgroundColor: DESIGN_TOKENS.colors.surface.page,
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
          FINANCIAL INFORMATION
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: DESIGN_TOKENS.spacing.gap.form, marginBottom: DESIGN_TOKENS.spacing.gap.form }}>
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
              onChange={(e) => updateFormData('purchase_price', parseFloat(e.target.value) || 0)}
              step="0.01"
              style={{
                width: '100%',
                height: '38px',
                backgroundColor: DESIGN_TOKENS.colors.surface.page,
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
              GST RATE (%)
            </div>
            <input
              type="number"
              value={formData.gst_rate}
              onChange={(e) => updateFormData('gst_rate', parseFloat(e.target.value) || 0)}
              step="0.01"
              style={{
                width: '100%',
                height: '38px',
                backgroundColor: DESIGN_TOKENS.colors.surface.page,
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
              DEPRECIATION RATE (%)
            </div>
            <input
              type="number"
              value={formData.depreciation_rate}
              onChange={(e) => updateFormData('depreciation_rate', parseFloat(e.target.value) || 0)}
              step="0.01"
              style={{
                width: '100%',
                height: '38px',
                backgroundColor: DESIGN_TOKENS.colors.surface.page,
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
          STOCK INFORMATION
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: DESIGN_TOKENS.spacing.gap.form, marginBottom: DESIGN_TOKENS.spacing.gap.form }}>
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
                backgroundColor: DESIGN_TOKENS.colors.surface.page,
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
                backgroundColor: DESIGN_TOKENS.colors.surface.page,
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
                backgroundColor: DESIGN_TOKENS.colors.surface.page,
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
              DEFAULT SOURCE LOCATION
            </div>
            <select
              value={formData.default_source_location}
              onChange={(e) => updateFormData('default_source_location', e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                backgroundColor: DESIGN_TOKENS.colors.surface.page,
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