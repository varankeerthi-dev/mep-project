import React, { useState, useEffect } from 'react';
import { Package, Plus, Trash2, Search, FileText, Download, Eye } from 'lucide-react';
import { useAuth } from '../App';
import ToolsIssueModal from '../components/tools/ToolsIssueModal';
import ToolsReceiveModal from '../components/tools/ToolsReceiveModal';
import ToolsTransferModal from '../components/tools/ToolsTransferModal';
import SiteTransferModal from '../components/tools/SiteTransferModal';
import ToolsDashboard from './ToolsDashboard';
import ToolsCatalog from './ToolsCatalog';
import ToolTransactionStorage from '../tools/storage';
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
  const [storage, setStorage] = useState(() => ToolTransactionStorage.getInstance());

  const organisationId = organisation?.id || '';

  const handleSubTabChange = (subTabId: string) => {
    setActiveSubTab(subTabId);
  };

  const handleOpenIssueModal = () => {
    setIsIssueModalOpen(true);
  };

  const handleOpenReceiveModal = () => {
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
      console.log('Modal submitted:', data);
      
      // Determine the type of transaction based on the data structure
      if (data.source_place && data.taken_by) {
        // This is an Issue Tools transaction
        await handleIssueTools(data);
      } else if (data.from_client && data.to_client) {
        // This is a Transfer Tools transaction
        await handleTransferToolsSubmit(data);
      } else if (data.returned_quantity !== undefined) {
        // This is a Receive Tools transaction
        await handleReceiveTools(data);
      } else if (data.from_project && data.to_project) {
        // This is a Site Transfer transaction
        await handleSiteTransferSubmit(data);
      }
      
      // Close the modal after successful submission
      setIsIssueModalOpen(false);
      setIsReceiveModalOpen(false);
      setIsTransferModalOpen(false);
      setIsSiteTransferModalOpen(false);
      
    } catch (error) {
      console.error('Error submitting modal:', error);
      alert('Error submitting transaction. Please try again.');
    }
  };

  const handleIssueTools = async (data: any) => {
    try {
      // Create issue transaction using storage
      const transaction = storage.createTransaction({
        reference_id: data.reference_id,
        transaction_date: data.date,
        client_id: data.client,
        transaction_type: 'ISSUE',
        status: 'ACTIVE',
        remarks: data.remarks,
        source_place: data.source_place,
        taken_by: data.taken_by,
        tools: data.tools.map((tool: any) => ({
          id: Date.now().toString() + Math.random(),
          tool_id: tool.id,
          tool_name: tool.tool_name,
          make: tool.make,
          category: tool.category,
          quantity: tool.quantity,
          hsn_code: tool.hsn_code,
          rate: tool.rate,
        }))
      });
      
      console.log('Issue transaction created:', transaction);
      
      alert(`Tools issued successfully! Reference: ${transaction.reference_id}`);
    } catch (error) {
      console.error('Error issuing tools:', error);
      throw error;
    }
  };

  const handleTransferToolsSubmit = async (data: any) => {
    try {
      // Create transfer transaction using storage
      const transaction = storage.createTransaction({
        reference_id: data.reference_id,
        transaction_date: data.date,
        from_client: data.from_client,
        to_client: data.to_client,
        transaction_type: 'TRANSFER',
        status: 'ACTIVE',
        remarks: data.reason_for_transfer,
        tools: data.tools.map((tool: any) => ({
          id: Date.now().toString() + Math.random(),
          tool_id: tool.id,
          tool_name: tool.tool_name,
          make: tool.make,
          category: tool.category,
          quantity: tool.quantity,
          hsn_code: tool.hsn_code,
          rate: tool.rate,
        }))
      });
      
      console.log('Transfer transaction created:', transaction);
      
      alert(`Tools transferred successfully! Reference: ${transaction.reference_id}`);
    } catch (error) {
      console.error('Error transferring tools:', error);
      throw error;
    }
  };

  const handleReceiveTools = async (data: any) => {
    try {
      // Create receive transaction using storage
      const transaction = storage.createTransaction({
        reference_id: data.reference_id,
        transaction_date: data.date,
        client_id: data.client,
        transaction_type: 'RECEIVE',
        status: data.transaction_status,
        remarks: data.remarks,
        received_by: data.receivedBy,
        tools: data.tools.map((tool: any) => ({
          id: Date.now().toString() + Math.random(),
          tool_id: tool.id,
          tool_name: tool.tool_name,
          make: tool.make,
          category: tool.category,
          quantity: tool.quantity,
          returned_quantity: tool.returned_quantity,
          hsn_code: tool.hsn_code,
          rate: tool.rate,
        }))
      });
      
      console.log('Receive transaction created:', transaction);
      
      alert(`Tools received successfully! Reference: ${transaction.reference_id}`);
    } catch (error) {
      console.error('Error receiving tools:', error);
      throw error;
    }
  };

  const handleSiteTransferSubmit = async (data: any) => {
    try {
      // Create site transfer transaction using storage
      const transaction = storage.createTransaction({
        reference_id: data.reference_id,
        transaction_date: data.date,
        from_project: data.fromProject,
        to_project: data.toProject,
        transaction_type: 'SITE_TRANSFER',
        status: 'ACTIVE',
        remarks: data.reason,
        transferred_by: data.transferredBy,
        received_by: data.receivedBy,
        vehicle_number: data.vehicleNumber,
        tools: data.tools.map((tool: any) => ({
          id: Date.now().toString() + Math.random(),
          tool_id: tool.id,
          tool_name: tool.tool_name,
          make: tool.make,
          category: tool.category,
          quantity: tool.quantity,
          hsn_code: tool.hsn_code,
          rate: tool.rate,
        }))
      });
      
      console.log('Site transfer transaction created:', transaction);
      
      alert(`Site transfer completed successfully! Reference: ${transaction.reference_id}`);
    } catch (error) {
      console.error('Error in site transfer:', error);
      throw error;
    }
  };

  const renderSubTabContent = () => {
    switch (activeSubTab) {
      case 'dashboard':
        return <ToolsDashboard />;
      case 'catalog':
        return <ToolsCatalog />;
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
            onClick={handleOpenIssueModal}
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
            onClick={handleOpenReceiveModal}
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
