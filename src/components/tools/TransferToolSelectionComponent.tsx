import React, { useState, useEffect } from 'react';
import { Search, Check, X, Package, User, AlertCircle } from 'lucide-react';
import { toolTransactionsApi, toolsApi, ToolCatalog } from '../../tools/api';
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

interface OpenTool {
  id: string;
  transaction_id: string;
  tool_name: string;
  make: string;
  category?: string;
  issued_quantity: number;
  available_quantity: number;
  client_name: string;
  client_id: string;
  issue_date: string;
  hsn_code?: string;
  rate?: number;
}

interface TransferToolSelectionComponentProps {
  isOpen: boolean;
  onClose: () => void;
  onSelection: (selectedTools: OpenTool[]) => void;
  organisation?: any;
  fromClientId?: string;
  filterType?: 'transfer' | 'site_transfer';
}

export default function TransferToolSelectionComponent({ 
  isOpen, 
  onClose, 
  onSelection, 
  organisation, 
  fromClientId,
  filterType = 'transfer'
}: TransferToolSelectionComponentProps) {
  const [openTools, setOpenTools] = useState<OpenTool[]>([]);
  const [filteredTools, setFilteredTools] = useState<OpenTool[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && organisation?.id) {
      loadOpenTools();
    }
  }, [isOpen, organisation, fromClientId]);

  useEffect(() => {
    const filtered = openTools.filter(tool =>
      tool.tool_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tool.make?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tool.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tool.client_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredTools(filtered);
  }, [searchTerm, openTools]);

  const loadOpenTools = async () => {
    try {
      setLoading(true);
      const orgId = organisation.id;

      // Get all active tool transactions (issued tools)
      const transactions = await toolTransactionsApi.getTransactions(orgId, {
        transaction_type: 'ISSUE',
        status: 'ACTIVE'
      });

      // Get transaction items to see what tools are issued
      const openToolsData: OpenTool[] = [];

      for (const transaction of transactions) {
        // Skip if fromClientId is specified and doesn't match
        if (fromClientId && transaction.client_id !== fromClientId) {
          continue;
        }

        const items = await toolTransactionsApi.getTransactionItems(orgId, transaction.id);
        
        for (const item of items) {
          // Calculate available quantity (issued - returned)
          const availableQuantity = item.quantity - (item.returned_quantity || 0);
          
          if (availableQuantity > 0) {
            openToolsData.push({
              id: `${transaction.id}-${item.tool_id}`,
              transaction_id: transaction.id,
              tool_name: item.tool?.tool_name || 'Unknown Tool',
              make: item.tool?.make || '',
              category: item.tool?.category || '',
              issued_quantity: item.quantity,
              available_quantity: availableQuantity,
              client_name: transaction.client?.name || 'Unknown Client',
              client_id: transaction.client_id || '',
              issue_date: transaction.transaction_date,
              hsn_code: item.tool?.hsn_code,
              rate: item.tool?.purchase_price,
            });
          }
        }
      }

      setOpenTools(openToolsData);
      setFilteredTools(openToolsData);
    } catch (error) {
      console.error('Error loading open tools:', error);
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
    const selectedToolObjects = openTools.filter(tool => selectedTools.has(tool.id));
    onSelection(selectedToolObjects);
    handleClose();
  };

  const handleClose = () => {
    setSelectedTools(new Set());
    setSearchTerm('');
    onClose();
  };

  const getToolStatus = (availableQuantity: number, issuedQuantity: number) => {
    if (availableQuantity === 0) return { status: 'FULLY RETURNED', color: 'text-zinc-600' };
    if (availableQuantity === issuedQuantity) return { status: 'FULLY AVAILABLE', color: 'text-green-600' };
    return { status: 'PARTIALLY RETURNED', color: 'text-orange-600' };
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
          width: '900px',
          maxWidth: '95vw',
          height: '650px',
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
            Select Open Tools for {filterType === 'site_transfer' ? 'Site Transfer' : 'Transfer'}
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
              placeholder="Search tools by name, make, category, or client..."
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
                <div>Loading open tools...</div>
              </div>
            </div>
          ) : filteredTools.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
              <div style={{ textAlign: 'center', color: DESIGN_TOKENS.colors.text.secondary }}>
                <AlertCircle size={48} style={{ margin: '0 auto 12px', display: 'block' }} />
                <div>No open tools found</div>
                <div style={{ fontSize: DESIGN_TOKENS.typography.input, marginTop: '4px' }}>
                  {searchTerm ? 'Try adjusting your search' : 'No tools are currently issued'}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {filteredTools.map((tool) => {
                const toolStatus = getToolStatus(tool.available_quantity, tool.issued_quantity);
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
                            {tool.make} {tool.category && `• ${tool.category}`}
                          </div>
                          <div style={{ 
                            fontSize: DESIGN_TOKENS.typography.label, 
                            color: DESIGN_TOKENS.colors.text.secondary,
                            marginBottom: '4px'
                          }}>
                            <User size={12} style={{ marginRight: '4px' }} />
                            {tool.client_name} • Issued: {tool.issue_date}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', marginLeft: '16px' }}>
                          <div style={{ 
                            fontSize: DESIGN_TOKENS.typography.input, 
                            fontWeight: 600, 
                            color: DESIGN_TOKENS.colors.text.primary,
                            marginBottom: '4px'
                          }}>
                            {tool.available_quantity} / {tool.issued_quantity}
                          </div>
                          <div style={{ 
                            fontSize: DESIGN_TOKENS.typography.label, 
                            fontWeight: 600, 
                            color: toolStatus.color 
                          }}>
                            {toolStatus.status}
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
