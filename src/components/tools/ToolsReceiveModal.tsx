import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Package, Calendar, User } from 'lucide-react';

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
  overlay: 'rgba(0,0,0,0.5)',
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

interface ToolItem {
  id: string;
  tool_name: string;
  make: string;
  quantity: number;
  returned_quantity: number;
  hsn_code?: string;
  rate?: number;
}

interface ToolsReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  loading?: boolean;
  organisation?: any;
}

export default function ToolsReceiveModal({ isOpen, onClose, onSubmit, loading = false, organisation }: ToolsReceiveModalProps) {
  const [referenceId, setReferenceId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [client, setClient] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [remarks, setRemarks] = useState('');
  const [tools, setTools] = useState<ToolItem[]>([]);
  const [transactionStatus, setTransactionStatus] = useState('ACTIVE');

  // Auto-populate from reference ID
  const handleReferenceIdChange = async (refId: string) => {
    if (refId.length >= 5) {
      try {
        // TODO: Fetch transaction details from API
        // const transaction = await toolTransactionsApi.getTransactionByRef(organisation.id, refId);
        // setClient(transaction.client_name);
        // setTools(transaction.items || []);
      } catch (error) {
        console.error('Error fetching transaction:', error);
      }
    }
  };

  const addTool = () => {
    const newTool: ToolItem = {
      id: Date.now().toString(),
      tool_name: '',
      make: '',
      quantity: 0,
      returned_quantity: 0,
      hsn_code: '',
      rate: 0,
    };
    setTools([...tools, newTool]);
  };

  const removeTool = (id: string) => {
    setTools(tools.filter(tool => tool.id !== id));
  };

  const updateTool = (id: string, field: keyof ToolItem, value: any) => {
    setTools(tools.map(tool => 
      tool.id === id ? { ...tool, [field]: value } : tool
    ));
  };

  const handleSubmit = () => {
    const formData = {
      reference_id: referenceId,
      date,
      client,
      received_by: receivedBy,
      remarks,
      tools,
      status: transactionStatus,
    };
    onSubmit(formData);
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
        backgroundColor: 'rgba(0,0,0,0.5)',
        backdropFilter: DESIGN_TOKENS.blur.overlay,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: DESIGN_TOKENS.spacing.container.standard,
          backgroundColor: DESIGN_TOKENS.colors.surface.card,
          borderRadius: DESIGN_TOKENS.borderRadius.subtle,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
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
            Receive Tools
          </h2>
          <button
            onClick={onClose}
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

        {/* Form Content */}
        <div style={{ padding: DESIGN_TOKENS.spacing.padding.main }}>
          {/* Reference ID & Date */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: DESIGN_TOKENS.spacing.gap.form,
            marginBottom: DESIGN_TOKENS.spacing.gap.form 
          }}>
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
                REFERENCE ID
              </div>
              <input
                type="text"
                value={referenceId}
                onChange={(e) => handleReferenceIdChange(e.target.value)}
                placeholder="Enter reference ID..."
                style={{
                  width: '100%',
                  height: '38px',
                  backgroundColor: DESIGN_TOKENS.colors.surface.page,
                  border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                  borderRadius: DESIGN_TOKENS.borderRadius.none,
                  fontSize: DESIGN_TOKENS.typography.monospace,
                  color: DESIGN_TOKENS.colors.text.primary,
                  padding: '0 12px',
                  fontFamily: 'JetBrains Mono, monospace',
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
                DATE
              </div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  backgroundColor: DESIGN_TOKENS.colors.surface.page,
                  border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                  borderRadius: DESIGN_TOKENS.borderRadius.none,
                  fontSize: DESIGN_TOKENS.typography.input,
                  color: DESIGN_TOKENS.colors.text.primary,
                  padding: '0 12px',
                  fontFamily: 'Inter, sans-serif',
                }}
              />
            </div>
          </div>

          {/* Client & Received By */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: DESIGN_TOKENS.spacing.gap.form,
            marginBottom: DESIGN_TOKENS.spacing.gap.form 
          }}>
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
                CLIENT
              </div>
              <input
                type="text"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Auto-populated from reference ID"
                style={{
                  width: '100%',
                  height: '38px',
                  backgroundColor: DESIGN_TOKENS.colors.surface.page,
                  border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                  borderRadius: DESIGN_TOKENS.borderRadius.none,
                  fontSize: DESIGN_TOKENS.typography.input,
                  color: DESIGN_TOKENS.colors.text.primary,
                  padding: '0 12px',
                  fontFamily: 'Inter, sans-serif',
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
                RECEIVED BY
              </div>
              <input
                type="text"
                value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)}
                placeholder="Employee name..."
                style={{
                  width: '100%',
                  height: '38px',
                  backgroundColor: DESIGN_TOKENS.colors.surface.page,
                  border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                  borderRadius: DESIGN_TOKENS.borderRadius.none,
                  fontSize: DESIGN_TOKENS.typography.input,
                  color: DESIGN_TOKENS.colors.text.primary,
                  padding: '0 12px',
                  fontFamily: 'Inter, sans-serif',
                }}
              />
            </div>
          </div>

          {/* Remarks */}
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
              REMARKS
            </div>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Condition notes, return details..."
              rows={3}
              style={{
                width: '100%',
                backgroundColor: DESIGN_TOKENS.colors.surface.page,
                border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                borderRadius: DESIGN_TOKENS.borderRadius.none,
                fontSize: DESIGN_TOKENS.typography.input,
                color: DESIGN_TOKENS.colors.text.primary,
                padding: '12px',
                fontFamily: 'Inter, sans-serif',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Transaction Status */}
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
              TRANSACTION STATUS
            </div>
            <select
              value={transactionStatus}
              onChange={(e) => setTransactionStatus(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                backgroundColor: DESIGN_TOKENS.colors.surface.page,
                border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                borderRadius: DESIGN_TOKENS.borderRadius.none,
                fontSize: DESIGN_TOKENS.typography.input,
                color: DESIGN_TOKENS.colors.text.primary,
                padding: '0 12px',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              <option value="ACTIVE">Active</option>
              <option value="PARTIAL">Partial Return</option>
              <option value="RETURNED">Fully Returned</option>
            </select>
          </div>

          {/* Tools Table */}
          <div style={{ marginBottom: DESIGN_TOKENS.spacing.gap.form }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: DESIGN_TOKENS.spacing.gap.label }}>
              <div
                style={{
                  fontSize: DESIGN_TOKENS.typography.label,
                  fontWeight: 600,
                  color: DESIGN_TOKENS.colors.text.primary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                TOOLS
              </div>
              <button
                onClick={addTool}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  backgroundColor: DESIGN_TOKENS.colors.surface.page,
                  border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                  borderRadius: DESIGN_TOKENS.borderRadius.none,
                  fontSize: DESIGN_TOKENS.typography.button,
                  fontWeight: 600,
                  color: DESIGN_TOKENS.colors.text.primary,
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                <Plus size={16} />
                Add Tool
              </button>
            </div>

            {/* Tools Header */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '2fr 1fr 80px 80px 60px', 
              gap: '8px',
              padding: '8px 0',
              borderBottom: `1px solid ${DESIGN_TOKENS.colors.border}`,
            }}>
              <div style={{ 
                fontSize: DESIGN_TOKENS.typography.label, 
                fontWeight: 600, 
                color: DESIGN_TOKENS.colors.text.secondary 
              }}>
                TOOL NAME
              </div>
              <div style={{ 
                fontSize: DESIGN_TOKENS.typography.label, 
                fontWeight: 600, 
                color: DESIGN_TOKENS.colors.text.secondary 
              }}>
                MAKE
              </div>
              <div style={{ 
                fontSize: DESIGN_TOKENS.typography.label, 
                fontWeight: 600, 
                color: DESIGN_TOKENS.colors.text.secondary 
              }}>
                ISSUED QTY
              </div>
              <div style={{ 
                fontSize: DESIGN_TOKENS.typography.label, 
                fontWeight: 600, 
                color: DESIGN_TOKENS.colors.text.secondary 
              }}>
                RETURNED QTY
              </div>
              <div style={{ 
                fontSize: DESIGN_TOKENS.typography.label, 
                fontWeight: 600, 
                color: DESIGN_TOKENS.colors.text.secondary 
              }}>
                BALANCE
              </div>
              <div style={{ width: '60px' }}></div>
            </div>

            {/* Tools List */}
            {tools.map((tool) => (
              <div key={tool.id} style={{ 
                display: 'grid', 
                gridTemplateColumns: '2fr 1fr 80px 80px 60px', 
                gap: '8px',
                padding: '8px 0',
                alignItems: 'center',
              }}>
                <input
                  type="text"
                  value={tool.tool_name}
                  onChange={(e) => updateTool(tool.id, 'tool_name', e.target.value)}
                  placeholder="Tool name..."
                  style={{
                    height: '38px',
                    backgroundColor: DESIGN_TOKENS.colors.surface.page,
                    border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                    borderRadius: DESIGN_TOKENS.borderRadius.none,
                    fontSize: DESIGN_TOKENS.typography.input,
                    color: DESIGN_TOKENS.colors.text.primary,
                    padding: '0 12px',
                    fontFamily: 'Inter, sans-serif',
                  }}
                />
                <input
                  type="text"
                  value={tool.make}
                  onChange={(e) => updateTool(tool.id, 'make', e.target.value)}
                  placeholder="Make..."
                  style={{
                    height: '38px',
                    backgroundColor: DESIGN_TOKENS.colors.surface.page,
                    border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                    borderRadius: DESIGN_TOKENS.borderRadius.none,
                    fontSize: DESIGN_TOKENS.typography.input,
                    color: DESIGN_TOKENS.colors.text.primary,
                    padding: '0 12px',
                    fontFamily: 'Inter, sans-serif',
                  }}
                />
                <input
                  type="number"
                  value={tool.quantity}
                  onChange={(e) => updateTool(tool.id, 'quantity', parseInt(e.target.value) || 0)}
                  min="0"
                  style={{
                    height: '38px',
                    backgroundColor: DESIGN_TOKENS.colors.surface.page,
                    border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                    borderRadius: DESIGN_TOKENS.borderRadius.none,
                    fontSize: DESIGN_TOKENS.typography.input,
                    color: DESIGN_TOKENS.colors.text.primary,
                    padding: '0 12px',
                    fontFamily: 'Inter, sans-serif',
                  }}
                />
                <input
                  type="number"
                  value={tool.returned_quantity}
                  onChange={(e) => updateTool(tool.id, 'returned_quantity', parseInt(e.target.value) || 0)}
                  min="0"
                  style={{
                    height: '38px',
                    backgroundColor: DESIGN_TOKENS.colors.surface.page,
                    border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                    borderRadius: DESIGN_TOKENS.borderRadius.none,
                    fontSize: DESIGN_TOKENS.typography.input,
                    color: DESIGN_TOKENS.colors.text.primary,
                    padding: '0 12px',
                    fontFamily: 'Inter, sans-serif',
                  }}
                />
                <div style={{
                  fontSize: DESIGN_TOKENS.typography.input,
                  color: DESIGN_TOKENS.colors.text.primary,
                  textAlign: 'center',
                  fontWeight: 600,
                }}>
                  {tool.quantity - tool.returned_quantity}
                </div>
                <button
                  onClick={() => removeTool(tool.id)}
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
                  <Trash2 size={16} color={DESIGN_TOKENS.colors.text.muted} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
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
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: 'transparent',
              border: `1px solid ${DESIGN_TOKENS.colors.border}`,
              borderRadius: DESIGN_TOKENS.borderRadius.none,
              fontSize: DESIGN_TOKENS.typography.button,
              fontWeight: 600,
              color: DESIGN_TOKENS.colors.text.secondary,
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              padding: '10px 20px',
              backgroundColor: loading ? DESIGN_TOKENS.colors.text.muted : DESIGN_TOKENS.colors.accent,
              border: 'none',
              borderRadius: DESIGN_TOKENS.borderRadius.none,
              fontSize: DESIGN_TOKENS.typography.button,
              fontWeight: 600,
              color: '#FFFFFF',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'Inter, sans-serif',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {loading ? (
              <>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #FFFFFF',
                  borderRadius: '50%',
                  borderTop: '2px solid transparent',
                  animation: 'spin 1s linear infinite',
                }}></div>
                Processing...
              </>
            ) : (
              <>
                <Package size={16} />
                Receive Tools
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // Add spinner animation
  if (typeof window !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
}
