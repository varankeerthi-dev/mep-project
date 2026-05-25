import React, { useState, useEffect } from 'react';
import { Package, Plus, Trash2, Search, FileText, Download, Eye } from 'lucide-react';
import { useAuth } from '../App';
import { supabase } from '../supabase';
import { toolTransactionsApi } from '../tools/api';
import { toast } from '../lib/logger';
import ToolsIssueModal from '../components/tools/ToolsIssueModal';
import ToolsReceiveModal from '../components/tools/ToolsReceiveModal';
import ToolsTransferModal from '../components/tools/ToolsTransferModal';
import SiteTransferModal from '../components/tools/SiteTransferModal';
import ToolsDashboard from './ToolsDashboard';
import ToolsCatalog from './ToolsCatalog';

// Design system tokens matching DESIGN.md
const DESIGN_TOKENS = {
  colors: {
    surface: {
      card: '#FFFFFF',      // Pure Surface
      page: '#F9FAFB',      // Canvas White
    },
    border: 'rgba(226,232,240,0.5)', // Whisper Border
    accent: '#2563EB',      // Executive Blue
    text: {
      primary: '#18181B',   // Charcoal Ink
      secondary: '#71717A', // Muted Steel
      muted: '#A1A1AA',
    }
  },
  typography: {
    title: '1.25rem',
    label: '0.75rem',
    input: '0.875rem',
    button: '0.875rem',
    monospace: '0.8125rem',
  },
  spacing: {
    padding: {
      main: '1.5rem',
    }
  },
  borderRadius: {
    standard: '0.5rem',
  }
};

const TOOLS_SUBTABS = [
  { id: 'dashboard', label: 'Dashboard', icon: Package },
  { id: 'catalog', label: 'Catalog', icon: FileText },
  { id: 'history', label: 'History', icon: Search },
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
        await handleIssueTools(data);
      } else if (data.from_client && data.to_client) {
        await handleTransferToolsSubmit(data);
      } else if (data.returned_quantity !== undefined) {
        await handleReceiveTools(data);
      } else if (data.from_project && data.to_project) {
        await handleSiteTransferSubmit(data);
      }
      
      setIsIssueModalOpen(false);
      setIsReceiveModalOpen(false);
      setIsTransferModalOpen(false);
      setIsSiteTransferModalOpen(false);
      
      // Trigger a storage-changed event to refresh child components
      window.dispatchEvent(new Event('storage-changed'));
    } catch (error) {
      console.error('Error submitting modal:', error);
      toast.error(`Failed to save: ${(error as Error).message}`);
    }
  };

  const handleIssueTools = async (data: any) => {
    try {
      const transaction = await toolTransactionsApi.createTransaction(organisationId, {
        reference_id: data.reference_id,
        transaction_type: 'ISSUE',
        transaction_date: data.date,
        client_id: data.client || null,
        taken_by: data.taken_by,
        remarks: data.remarks || null,
        status: 'ACTIVE',
      });

      for (const tool of data.tools) {
        await supabase.from('tool_transaction_items').insert({
          transaction_id: transaction.id,
          tool_id: tool.id,
          quantity: tool.quantity,
          organisation_id: organisationId,
        });

        const { data: currentTool } = await supabase
          .from('tools_catalog')
          .select('current_stock')
          .eq('id', tool.id)
          .single();

        if (currentTool) {
          await supabase
            .from('tools_catalog')
            .update({ current_stock: currentTool.current_stock - tool.quantity })
            .eq('id', tool.id);
        }
      }

      toast.success(`Tools issued successfully! Reference: ${data.reference_id}`);
    } catch (error) {
      console.error('Error issuing tools:', error);
      toast.error(`Failed to issue tools: ${(error as Error).message}`);
      throw error;
    }
  };

  const handleTransferToolsSubmit = async (data: any) => {
    try {
      const transaction = await toolTransactionsApi.createTransaction(organisationId, {
        reference_id: data.reference_id,
        transaction_type: 'TRANSFER',
        transaction_date: data.date,
        from_client_id: data.from_client || null,
        to_client_id: data.to_client || null,
        remarks: data.reason_for_transfer || null,
        status: 'ACTIVE',
      });

      for (const tool of data.tools) {
        await supabase.from('tool_transaction_items').insert({
          transaction_id: transaction.id,
          tool_id: tool.id,
          quantity: tool.quantity,
          organisation_id: organisationId,
        });
      }

      toast.success(`Tools transferred successfully! Reference: ${data.reference_id}`);
    } catch (error) {
      console.error('Error transferring tools:', error);
      toast.error(`Failed to transfer tools: ${(error as Error).message}`);
      throw error;
    }
  };

  const handleReceiveTools = async (data: any) => {
    try {
      const transaction = await toolTransactionsApi.createTransaction(organisationId, {
        reference_id: data.reference_id,
        transaction_type: 'RECEIVE',
        transaction_date: data.date,
        client_id: data.client || null,
        received_by: data.receivedBy || null,
        remarks: data.remarks || null,
        status: data.transaction_status || 'RETURNED',
      });

      for (const tool of data.tools) {
        await supabase.from('tool_transaction_items').insert({
          transaction_id: transaction.id,
          tool_id: tool.id,
          quantity: tool.quantity,
          returned_quantity: tool.returned_quantity || 0,
          organisation_id: organisationId,
        });

        const { data: currentTool } = await supabase
          .from('tools_catalog')
          .select('current_stock')
          .eq('id', tool.id)
          .single();

        if (currentTool) {
          await supabase
            .from('tools_catalog')
            .update({ current_stock: currentTool.current_stock + (tool.returned_quantity || tool.quantity) })
            .eq('id', tool.id);
        }
      }

      toast.success(`Tools received successfully! Reference: ${data.reference_id}`);
    } catch (error) {
      console.error('Error receiving tools:', error);
      toast.error(`Failed to receive tools: ${(error as Error).message}`);
      throw error;
    }
  };

  const handleSiteTransferSubmit = async (data: any) => {
    try {
      const transaction = await toolTransactionsApi.createTransaction(organisationId, {
        reference_id: data.reference_id,
        transaction_type: 'SITE_TRANSFER',
        transaction_date: data.date,
        from_project_id: data.fromProject || null,
        to_project_id: data.toProject || null,
        transferred_by: data.transferredBy || null,
        received_by: data.receivedBy || null,
        remarks: data.reason || null,
        status: 'IN_TRANSIT',
      });

      for (const tool of data.tools) {
        await supabase.from('tool_transaction_items').insert({
          transaction_id: transaction.id,
          tool_id: tool.id,
          quantity: tool.quantity,
          organisation_id: organisationId,
        });
      }

      toast.success(`Site transfer completed successfully! Reference: ${data.reference_id}`);
    } catch (error) {
      console.error('Error in site transfer:', error);
      toast.error(`Failed to transfer tools: ${(error as Error).message}`);
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
        return (
          <div className="flex flex-col items-center justify-center p-12 text-center text-zinc-500 min-h-[400px]">
            <Package size={48} className="mb-4 text-zinc-400 opacity-60" />
            <h3 className="text-lg font-medium text-zinc-800 mb-1">Tools History</h3>
            <p className="text-sm text-zinc-500 max-w-sm">History logs and transaction records will appear here.</p>
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center p-12 text-center text-zinc-500 min-h-[400px]">
            <Package size={48} className="mb-4 text-zinc-400 opacity-60" />
            <h3 className="text-lg font-medium text-zinc-800 mb-1">Select a sub-tab</h3>
            <p className="text-sm text-zinc-500">Pick a category to manage tools.</p>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F9FAFB] min-h-screen text-[#18181B] font-sans">
      {/* Header */}
      <div className="px-6 py-5 flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
              Tools Management
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Track your tools inventory, schedule site movements, and coordinate allocations
            </p>
          </div>

          {/* Quick Actions Row */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleOpenIssueModal}
              className="inline-flex items-center justify-center text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm active:translate-y-[1px] transition-all"
              style={{ height: '44px', paddingLeft: '20px', paddingRight: '20px' }}
            >
              <Plus size={16} className="mr-1.5" />
              Issue Tools
            </button>
            <button
              onClick={handleOpenReceiveModal}
              className="inline-flex items-center justify-center text-sm font-semibold text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 active:translate-y-[1px] transition-all"
              style={{ height: '44px', paddingLeft: '20px', paddingRight: '20px' }}
            >
              <Package size={16} className="mr-1.5" />
              Receive Tools
            </button>
            <button
              onClick={handleTransferTools}
              className="inline-flex items-center justify-center text-sm font-semibold text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 active:translate-y-[1px] transition-all"
              style={{ height: '44px', paddingLeft: '20px', paddingRight: '20px' }}
            >
              <Package size={16} className="mr-1.5" />
              Transfer Tools
            </button>
            <button
              onClick={handleSiteTransfer}
              className="inline-flex items-center justify-center text-sm font-semibold text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 active:translate-y-[1px] transition-all"
              style={{ height: '44px', paddingLeft: '20px', paddingRight: '20px' }}
            >
              <Package size={16} className="mr-1.5" />
              Site Transfer
            </button>
          </div>
      </div>

      {/* Sub-tabs Horizontal Navigation */}
      <div className="border-b border-zinc-200 bg-white px-6" style={{ paddingTop: '10px', paddingBottom: '10px' }}>
        <div className="flex items-center gap-1">
          {TOOLS_SUBTABS.map((subtab) => {
            const isActive = activeSubTab === subtab.id;
            const Icon = subtab.icon;
            return (
              <button
                key={subtab.id}
                onClick={() => handleSubTabChange(subtab.id)}
                style={{ height: '34px', lineHeight: '24px' }}
                className={`flex items-center gap-2 px-4 text-[15px] font-medium rounded-md transition-all duration-150 active:scale-[0.97] ${
                  isActive
                    ? 'bg-blue-600/10 text-blue-600 font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
              >
                <Icon size={15} className={isActive ? 'text-blue-500' : 'text-zinc-400'} />
                {subtab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-tab Content Container */}
      <div className="flex-1 overflow-auto bg-[#F9FAFB]">
        <div className="mx-auto max-w-[1400px]">
          {renderSubTabContent()}
        </div>
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
