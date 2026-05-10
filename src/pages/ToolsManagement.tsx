import React, { useState, useEffect } from 'react';
import { Package, Plus, Trash2, Search, FileText, Download, Eye } from 'lucide-react';
import { useAuth } from '../App';
import ToolsIssueModal from '../components/tools/ToolsIssueModal';
import ToolsReceiveModal from '../components/tools/ToolsReceiveModal';
import ToolsTransferModal from '../components/tools/ToolsTransferModal';
import SiteTransferModal from '../components/tools/SiteTransferModal';
import ToolsDashboard from './ToolsDashboard';
// import ToolsCatalog from './ToolsCatalog';
// import ToolsHistory from './ToolsHistory';

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

const TOOLS_SUBTABS = [
  { id: 'dashboard', label: 'Dashboard', icon: Package },
  { id: 'catalog', label: 'Catalog', icon: FileText },
  { id: 'history', label: 'History', icon: Search },
  { id: 'issue', label: 'Issue Tools', icon: Plus },
  { id: 'receive', label: 'Receive Tools', icon: Package },
  { id: 'transfer', label: 'Transfer Tools', icon: Package },
  { id: 'site-transfer', label: 'Site Transfer', icon: Package },
];

export default function ToolsManagement() {
  const { organisation } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState('dashboard');
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isSiteTransferModalOpen, setIsSiteTransferModalOpen] = useState(false);

  const organisationId = organisation?.id || '';

  const handleSubTabChange = (subTabId: string) => {
    setActiveSubTab(subTabId);
  };

  const handleIssueTools = () => {
    setIsIssueModalOpen(true);
  };

  const handleReceiveTools = () => {
    setIsReceiveModalOpen(true);
  };

  const handleTransferTools = () => {
    setIsTransferModalOpen(true);
  };

  const handleSiteTransfer = () => {
    setIsSiteTransferModalOpen(true);
  };

  const handleModalSubmit = async (data: any) => {
    try {
      // TODO: Implement actual API calls
      console.log('Modal submitted:', data);
    } catch (error) {
      console.error('Error submitting modal:', error);
    }
  };

  const renderSubTabContent = () => {
    switch (activeSubTab) {
      case 'dashboard':
        return <ToolsDashboard />;
      case 'catalog':
        // return <ToolsCatalog />;
        return (
          <div style={{ 
            padding: DESIGN_TOKENS.spacing.padding.main, 
            textAlign: 'center',
            color: DESIGN_TOKENS.colors.text.muted 
          }}>
            <Package size={48} style={{ marginBottom: '16px' }} />
            <p style={{ fontSize: '16px', marginBottom: '8px' }}>Tools Catalog - Coming Soon</p>
          </div>
        );
      case 'history':
        // return <ToolsHistory />;
        return (
          <div style={{ 
            padding: DESIGN_TOKENS.spacing.padding.main, 
            textAlign: 'center',
            color: DESIGN_TOKENS.colors.text.muted 
          }}>
            <Package size={48} style={{ marginBottom: '16px' }} />
            <p style={{ fontSize: '16px', marginBottom: '8px' }}>Tools History - Coming Soon</p>
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
            <p style={{ fontSize: '16px', marginBottom: '8px' }}>Select a sub-tab to get started</p>
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
              Tools Management
            </h1>
            <p style={{ 
              fontSize: DESIGN_TOKENS.typography.input, 
              color: DESIGN_TOKENS.colors.text.secondary, 
              margin: '4px 0 0' 
            }}>
              Manage your tools inventory, track movements, and streamline operations
            </p>
          </div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div style={{ 
        background: DESIGN_TOKENS.colors.surface.page, 
        padding: DESIGN_TOKENS.spacing.padding.main,
        borderBottom: `1px solid ${DESIGN_TOKENS.colors.border}` 
      }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <button
            onClick={handleIssueTools}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              backgroundColor: DESIGN_TOKENS.colors.accent,
              border: 'none',
              borderRadius: DESIGN_TOKENS.borderRadius.none,
              fontSize: DESIGN_TOKENS.typography.button,
              fontWeight: 600,
              color: '#FFFFFF',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <Plus size={16} />
            Issue Tools
          </button>
          <button
            onClick={handleReceiveTools}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              backgroundColor: DESIGN_TOKENS.colors.surface.card,
              border: `1px solid ${DESIGN_TOKENS.colors.border}`,
              borderRadius: DESIGN_TOKENS.borderRadius.none,
              fontSize: DESIGN_TOKENS.typography.button,
              fontWeight: 600,
              color: DESIGN_TOKENS.colors.text.primary,
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <Package size={16} />
            Receive Tools
          </button>
          <button
            onClick={handleTransferTools}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              backgroundColor: DESIGN_TOKENS.colors.surface.card,
              border: `1px solid ${DESIGN_TOKENS.colors.border}`,
              borderRadius: DESIGN_TOKENS.borderRadius.none,
              fontSize: DESIGN_TOKENS.typography.button,
              fontWeight: 600,
              color: DESIGN_TOKENS.colors.text.primary,
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <Package size={16} />
            Transfer Tools
          </button>
          <button
            onClick={handleSiteTransfer}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              backgroundColor: DESIGN_TOKENS.colors.surface.card,
              border: `1px solid ${DESIGN_TOKENS.colors.border}`,
              borderRadius: DESIGN_TOKENS.borderRadius.none,
              fontSize: DESIGN_TOKENS.typography.button,
              fontWeight: 600,
              color: DESIGN_TOKENS.colors.text.primary,
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <Package size={16} />
            Site Transfer
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ 
        background: DESIGN_TOKENS.colors.surface.card, 
        borderBottom: `1px solid ${DESIGN_TOKENS.colors.border}` 
      }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {TOOLS_SUBTABS.map((subtab) => {
            const isActive = activeSubTab === subtab.id;
            const Icon = subtab.icon;
            return (
              <button
                key={subtab.id}
                onClick={() => handleSubTabChange(subtab.id)}
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
                <Icon size={18} />
                {subtab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-tab Content */}
      <div style={{ 
        flex: 1, 
        overflow: 'auto', 
        background: DESIGN_TOKENS.colors.surface.page 
      }}>
        {renderSubTabContent()}
      </div>

      {/* Modals */}
      <ToolsIssueModal
        isOpen={isIssueModalOpen}
        onClose={() => setIsIssueModalOpen(false)}
        onSubmit={handleModalSubmit}
        organisation={organisation}
      />

      <ToolsReceiveModal
        isOpen={isReceiveModalOpen}
        onClose={() => setIsReceiveModalOpen(false)}
        onSubmit={handleModalSubmit}
        organisation={organisation}
      />

      <ToolsTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onSubmit={handleModalSubmit}
        organisation={organisation}
      />

      <SiteTransferModal
        isOpen={isSiteTransferModalOpen}
        onClose={() => setIsSiteTransferModalOpen(false)}
        onSubmit={handleModalSubmit}
        organisation={organisation}
      />
    </div>
  );
}
