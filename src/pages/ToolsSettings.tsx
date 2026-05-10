import React, { useState, useEffect } from 'react';
import { Settings, Save, X, Package, FileText, Download } from 'lucide-react';
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
};

export default function ToolsSettings() {
  const { organisation } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(false);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      // TODO: Implement actual API save
      console.log('Saving settings...');
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div style={{ padding: DESIGN_TOKENS.spacing.padding.main }}>
            <div style={{ marginBottom: DESIGN_TOKENS.spacing.gap.form }}>
              <h3 style={{ 
                fontSize: DESIGN_TOKENS.typography.title, 
                fontWeight: 600, 
                color: DESIGN_TOKENS.colors.text.primary, 
                marginBottom: DESIGN_TOKENS.spacing.gap.form 
              }}>
                General Settings
              </h3>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: DESIGN_TOKENS.spacing.gap.form,
                marginBottom: DESIGN_TOKENS.spacing.gap.form 
              }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: DESIGN_TOKENS.typography.label, 
                    fontWeight: 600, 
                    color: DESIGN_TOKENS.colors.text.primary, 
                    marginBottom: DESIGN_TOKENS.spacing.gap.label, 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.04em' 
                  }}>
                    ORGANISATION NAME
                  </label>
                  <input
                    type="text"
                    defaultValue={organisation?.name || ''}
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
                  <label style={{ 
                    display: 'block', 
                    fontSize: DESIGN_TOKENS.typography.label, 
                    fontWeight: 600, 
                    color: DESIGN_TOKENS.colors.text.primary, 
                    marginBottom: DESIGN_TOKENS.spacing.gap.label, 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.04em' 
                  }}>
                    DEFAULT TOOLS LOCATION
                  </label>
                  <select
                    defaultValue="Warehouse"
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
                    <option value="Warehouse">Warehouse</option>
                    <option value="Main Office">Main Office</option>
                    <option value="Central Store">Central Store</option>
                    <option value="Regional Hub">Regional Hub</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: DESIGN_TOKENS.spacing.gap.form }}>
              <h3 style={{ 
                fontSize: DESIGN_TOKENS.typography.title, 
                fontWeight: 600, 
                color: DESIGN_TOKENS.colors.text.primary, 
                marginBottom: DESIGN_TOKENS.spacing.gap.form 
              }}>
                Notification Settings
              </h3>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: DESIGN_TOKENS.spacing.gap.form,
                marginBottom: DESIGN_TOKENS.spacing.gap.form 
              }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: DESIGN_TOKENS.typography.label, 
                    fontWeight: 600, 
                    color: DESIGN_TOKENS.colors.text.primary, 
                    marginBottom: DESIGN_TOKENS.spacing.gap.label, 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.04em' 
                  }}>
                    STOCK ALERTS
                  </label>
                  <select
                    defaultValue="enabled"
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
                    <option value="enabled">Enabled</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: DESIGN_TOKENS.typography.label, 
                    fontWeight: 600, 
                    color: DESIGN_TOKENS.colors.text.primary, 
                    marginBottom: DESIGN_TOKENS.spacing.gap.label, 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.04em' 
                  }}>
                    MINIMUM STOCK LEVEL
                  </label>
                  <input
                    type="number"
                    defaultValue="5"
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
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: DESIGN_TOKENS.spacing.gap.form }}>
              <button
                onClick={handleSave}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  backgroundColor: loading ? DESIGN_TOKENS.colors.text.muted : DESIGN_TOKENS.colors.accent,
                  border: 'none',
                  borderRadius: DESIGN_TOKENS.borderRadius.none,
                  fontSize: DESIGN_TOKENS.typography.button,
                  fontWeight: 600,
                  color: '#FFFFFF',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {loading ? (
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid #FFFFFF',
                    borderRadius: '50%',
                    borderTop: '2px solid transparent',
                    animation: 'spin 1s linear infinite',
                  }}></div>
                ) : (
                  <>
                    <Save size={16} />
                    Save Settings
                  </>
                )}
              </button>
            </div>
          </div>
        );

      case 'template':
        return (
          <div style={{ padding: DESIGN_TOKENS.spacing.padding.main }}>
            <div style={{ marginBottom: DESIGN_TOKENS.spacing.gap.form }}>
              <h3 style={{ 
                fontSize: DESIGN_TOKENS.typography.title, 
                fontWeight: 600, 
                color: DESIGN_TOKENS.colors.text.primary, 
                marginBottom: DESIGN_TOKENS.spacing.gap.form 
              }}>
                Template Settings
              </h3>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: DESIGN_TOKENS.spacing.gap.form,
                marginBottom: DESIGN_TOKENS.spacing.gap.form 
              }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: DESIGN_TOKENS.typography.label, 
                    fontWeight: 600, 
                    color: DESIGN_TOKENS.colors.text.primary, 
                    marginBottom: DESIGN_TOKENS.spacing.gap.label, 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.04em' 
                  }}>
                    DEFAULT PDF TEMPLATE
                  </label>
                  <select
                    defaultValue="classic"
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
                    <option value="classic">Classic</option>
                    <option value="progrid">ProGrid</option>
                  </select>
                </div>
                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: DESIGN_TOKENS.typography.label, 
                    fontWeight: 600, 
                    color: DESIGN_TOKENS.colors.text.primary, 
                    marginBottom: DESIGN_TOKENS.spacing.gap.label, 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.04em' 
                  }}>
                    COLUMN VISIBILITY
                  </label>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: DESIGN_TOKENS.spacing.gap.form 
                  }}>
                    <div>
                      <input
                        type="checkbox"
                        id="show_make_column"
                        defaultChecked={true}
                        style={{
                          marginRight: '8px',
                        transform: 'scale(1.2)',
                        cursor: 'pointer',
                        accentColor: DESIGN_TOKENS.colors.accent,
                      }}
                      />
                      <label htmlFor="show_make_column" style={{ 
                        fontSize: DESIGN_TOKENS.typography.input, 
                        color: DESIGN_TOKENS.colors.text.primary,
                      }}>
                        Show "Make (Tool Source)" Column
                      </label>
                    </div>
                    <div>
                      <input
                        type="checkbox"
                        id="show_hsn_column"
                        defaultChecked={true}
                        style={{
                          marginRight: '8px',
                          transform: 'scale(1.2)',
                          cursor: 'pointer',
                          accentColor: DESIGN_TOKENS.colors.accent,
                        }}
                      />
                      <label htmlFor="show_hsn_column" style={{ 
                        fontSize: DESIGN_TOKENS.typography.input, 
                        color: DESIGN_TOKENS.colors.text.primary,
                      }}>
                        Show "HSN Code" Column
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: DESIGN_TOKENS.spacing.gap.form }}>
              <button
                onClick={handleSave}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  backgroundColor: loading ? DESIGN_TOKENS.colors.text.muted : DESIGN_TOKENS.colors.accent,
                  border: 'none',
                  borderRadius: DESIGN_TOKENS.borderRadius.none,
                  fontSize: DESIGN_TOKENS.typography.button,
                  fontWeight: 600,
                  color: '#FFFFFF',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {loading ? (
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid #FFFFFF',
                    borderRadius: '50%',
                    borderTop: '2px solid transparent',
                    animation: 'spin 1s linear infinite',
                  }}></div>
                ) : (
                  <>
                    <Save size={16} />
                    Save Settings
                  </>
                )}
              </button>
            </div>
          </div>
        );

      default:
        return (
          <div style={{ 
            padding: DESIGN_TOKENS.spacing.padding.main, 
            textAlign: 'center',
            color: DESIGN_TOKENS.colors.text.muted 
          }}>
            <Package size={48} style={{ marginBottom: '16px' }} />
            <p style={{ fontSize: DESIGN_TOKENS.typography.input, marginBottom: '8px' }}>Select a tab to configure Tools settings</p>
          </div>
        );
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ 
        background: DESIGN_TOKENS.colors.surface.card, 
        borderBottom: `1px solid ${DESIGN_TOKENS.colors.border}`, 
        padding: DESIGN_TOKENS.spacing.padding.main 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ 
              fontSize: '24px', 
              fontWeight: 700, 
              color: DESIGN_TOKENS.colors.text.primary, 
              margin: 0 
            }}>
              Tools Settings
            </h1>
            <p style={{ 
              fontSize: DESIGN_TOKENS.typography.input, 
              color: DESIGN_TOKENS.colors.text.secondary, 
              margin: '4px 0 0' 
            }}>
              Configure your tools management preferences and templates
            </p>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ 
        background: DESIGN_TOKENS.colors.surface.page, 
        borderBottom: `1px solid ${DESIGN_TOKENS.colors.border}` 
      }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {['general', 'template'].map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '16px 20px',
                  border: 'none',
                  borderBottom: `2px solid ${isActive ? DESIGN_TOKENS.colors.accent : 'transparent'}`,
                  background: 'transparent',
                  color: isActive ? DESIGN_TOKENS.colors.accent : DESIGN_TOKENS.colors.text.secondary,
                  fontSize: DESIGN_TOKENS.typography.button,
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                <Settings size={18} />
                {tab === 'general' ? 'General' : 'Template'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ 
        flex: 1, 
        overflow: 'auto', 
        background: DESIGN_TOKENS.colors.surface.page 
      }}>
        {renderTabContent()}
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
