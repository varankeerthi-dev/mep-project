import React, { useState, useEffect } from 'react';
import { Search, Check, X, Package } from 'lucide-react';
import { toolsApi, ToolCatalog } from '../../tools/api';
import { useAuth } from '../../App';

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
};

interface ToolSelectionComponentProps {
  isOpen: boolean;
  onClose: () => void;
  onSelection: (selectedTools: ToolCatalog[]) => void;
  organisation?: any;
}

export default function ToolSelectionComponent({ isOpen, onClose, onSelection, organisation }: ToolSelectionComponentProps) {
  const [tools, setTools] = useState<ToolCatalog[]>([]);
  const [filteredTools, setFilteredTools] = useState<ToolCatalog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && organisation?.id) {
      loadTools();
    }
  }, [isOpen, organisation]);

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
      // Only show tools with available stock
      const availableTools = toolsData.filter(tool => (tool.current_stock || 0) > 0);
      setTools(availableTools);
      setFilteredTools(availableTools);
    } catch (error) {
      console.error('Error loading tools:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleToolSelection = (toolId: string) => {
    const newSelected = new Set(selectedTools);
    if (newSelected.has(toolId)) {
      newSelected.delete(toolId);
    } else {
      newSelected.add(toolId);
    }
    setSelectedTools(newSelected);
  };

  const handleAddSelected = () => {
    const selectedToolObjects = tools.filter(tool => selectedTools.has(tool.id));
    onSelection(selectedToolObjects);
    handleClose();
  };

  const handleClose = () => {
    setSelectedTools(new Set());
    setSearchTerm('');
    onClose();
  };

  const getStockStatus = (currentStock: number, minStock: number) => {
    if (currentStock === 0) return { status: 'OUT OF STOCK', color: 'text-red-600' };
    if (currentStock <= minStock) return { status: 'LOW STOCK', color: 'text-orange-600' };
    return { status: 'IN STOCK', color: 'text-green-600' };
  };

  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: '800px',
          maxWidth: '90vw',
          height: '600px',
          maxHeight: '90vh',
          backgroundColor: DESIGN_TOKENS.colors.surface.card,
          borderRadius: DESIGN_TOKENS.borderRadius.subtle,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            height: '64px',
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
              fontWeight: 600,
              color: DESIGN_TOKENS.colors.text.primary,
              margin: 0,
            }}
          >
            Select Tools from Catalog
          </h2>
          <button
            onClick={handleClose}
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

        {/* Search Bar */}
        <div style={{ padding: DESIGN_TOKENS.spacing.padding.main, borderBottom: `1px solid ${DESIGN_TOKENS.colors.border}` }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: DESIGN_TOKENS.colors.text.muted }} />
            <input
              type="text"
              placeholder="Search tools by name, make, or category..."
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
        </div>

        {/* Tools List */}
        <div style={{ flex: 1, overflow: 'auto', padding: DESIGN_TOKENS.spacing.padding.main }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
              <div style={{ textAlign: 'center', color: DESIGN_TOKENS.colors.text.secondary }}>
                <Package size={48} style={{ margin: '0 auto 12px', display: 'block' }} />
                <div>Loading tools...</div>
              </div>
            </div>
          ) : filteredTools.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
              <div style={{ textAlign: 'center', color: DESIGN_TOKENS.colors.text.secondary }}>
                <Package size={48} style={{ margin: '0 auto 12px', display: 'block' }} />
                <div>No tools found</div>
                <div style={{ fontSize: DESIGN_TOKENS.typography.input, marginTop: '4px' }}>
                  {searchTerm ? 'Try adjusting your search' : 'No tools available in stock'}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {filteredTools.map((tool) => {
                const stockStatus = getStockStatus(tool.current_stock || 0, tool.min_stock_level || 0);
                const isSelected = selectedTools.has(tool.id);
                
                return (
                  <div
                    key={tool.id}
                    onClick={() => toggleToolSelection(tool.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '16px',
                      border: `1px solid ${isSelected ? DESIGN_TOKENS.colors.accent : DESIGN_TOKENS.colors.border}`,
                      borderRadius: DESIGN_TOKENS.borderRadius.subtle,
                      backgroundColor: isSelected ? '#FEE2E2' : DESIGN_TOKENS.colors.surface.card,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {/* Checkbox */}
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        border: `2px solid ${isSelected ? DESIGN_TOKENS.colors.accent : DESIGN_TOKENS.colors.border}`,
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '16px',
                        backgroundColor: isSelected ? DESIGN_TOKENS.colors.accent : 'transparent',
                      }}
                    >
                      {isSelected && <Check size={14} color="#FFFFFF" />}
                    </div>

                    {/* Tool Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ 
                            fontSize: DESIGN_TOKENS.typography.input, 
                            fontWeight: 600, 
                            color: DESIGN_TOKENS.colors.text.primary,
                            marginBottom: '4px'
                          }}>
                            {tool.tool_name}
                          </div>
                          <div style={{ 
                            fontSize: DESIGN_TOKENS.typography.input, 
                            color: DESIGN_TOKENS.colors.text.secondary,
                            marginBottom: '4px'
                          }}>
                            {tool.make} {tool.model && `- ${tool.model}`}
                          </div>
                          <div style={{ 
                            fontSize: DESIGN_TOKENS.typography.label, 
                            color: DESIGN_TOKENS.colors.text.secondary,
                            marginBottom: '4px'
                          }}>
                            Category: {tool.category || 'N/A'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', marginLeft: '16px' }}>
                          <div style={{ 
                            fontSize: DESIGN_TOKENS.typography.input, 
                            fontWeight: 600, 
                            color: DESIGN_TOKENS.colors.text.primary,
                            marginBottom: '4px'
                          }}>
                            Stock: {tool.current_stock || 0}
                          </div>
                          <div style={{ 
                            fontSize: DESIGN_TOKENS.typography.label, 
                            fontWeight: 600, 
                            color: stockStatus.color 
                          }}>
                            {stockStatus.status}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            height: '64px',
            backgroundColor: DESIGN_TOKENS.colors.surface.page,
            borderTop: `1px solid ${DESIGN_TOKENS.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `0 ${DESIGN_TOKENS.spacing.padding.main}px`,
          }}
        >
          <div style={{ fontSize: DESIGN_TOKENS.typography.input, color: DESIGN_TOKENS.colors.text.secondary }}>
            {selectedTools.size} tool{selectedTools.size !== 1 ? 's' : ''} selected
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleClose}
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
              onClick={handleAddSelected}
              disabled={selectedTools.size === 0}
              style={{
                padding: '10px 20px',
                backgroundColor: selectedTools.size === 0 ? DESIGN_TOKENS.colors.text.muted : DESIGN_TOKENS.colors.accent,
                border: 'none',
                borderRadius: DESIGN_TOKENS.borderRadius.none,
                fontSize: DESIGN_TOKENS.typography.button,
                fontWeight: 600,
                color: '#FFFFFF',
                cursor: selectedTools.size === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              Add Selected Tools ({selectedTools.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
