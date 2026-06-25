import React, { useState, useEffect } from 'react';
import { Package, Plus, FileText, Search } from 'lucide-react';
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

const sectionHeadStyle: React.CSSProperties = {
  fontWeight: 600, fontSize: '11px', color: '#6b7280',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px'
};

const primaryBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '4px',
  padding: '6px 14px', background: '#185FA5',
  border: '1px solid #185FA5', color: '#fff',
  borderRadius: '6px', fontSize: '12px', fontWeight: 500,
  cursor: 'pointer', transition: 'all 0.15s'
};

const secondaryBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '4px',
  padding: '6px 14px', background: '#fff',
  border: '1px solid #d1d5db', color: '#374151',
  borderRadius: '6px', fontSize: '12px', fontWeight: 500,
  cursor: 'pointer', transition: 'all 0.15s'
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

  const handleOpenIssueModal = () => setIsIssueModalOpen(true);
  const handleOpenReceiveModal = () => setIsReceiveModalOpen(true);
  const handleTransferTools = () => setIsTransferModalOpen(true);
  const handleSiteTransfer = () => setIsSiteTransferModalOpen(true);

  const handleModalSubmit = async (data: any) => {
    try {
      console.log('Modal submitted:', data);
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
    <div className="flex flex-col h-full bg-[#F9FAFB] min-h-screen" style={{ fontFamily: "'Geist Variable', 'Inter', system-ui, sans-serif" }}>
      <div className="px-6 py-5 flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Tools Management
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Track your tools inventory, schedule site movements, and coordinate allocations
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleOpenIssueModal}
            style={primaryBtn}
            onMouseEnter={e => { e.currentTarget.style.background = '#0C447C'; e.currentTarget.style.borderColor = '#0C447C'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#185FA5'; e.currentTarget.style.borderColor = '#185FA5'; }}
          >
            <Plus size={13} />
            Issue Tools
          </button>
          <button
            onClick={handleOpenReceiveModal}
            style={secondaryBtn}
            onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
          >
            <Package size={13} />
            Receive Tools
          </button>
          <button
            onClick={handleTransferTools}
            style={secondaryBtn}
            onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
          >
            <Package size={13} />
            Transfer Tools
          </button>
          <button
            onClick={handleSiteTransfer}
            style={secondaryBtn}
            onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
          >
            <Package size={13} />
            Site Transfer
          </button>
        </div>
      </div>

      <div className="border-b border-zinc-200 bg-white px-6" style={{ paddingTop: '10px', paddingBottom: '10px' }}>
        <div className="flex items-center gap-1">
          {TOOLS_SUBTABS.map((subtab) => {
            const isActive = activeSubTab === subtab.id;
            const Icon = subtab.icon;
            return (
              <button
                key={subtab.id}
                onClick={() => handleSubTabChange(subtab.id)}
                className={`flex items-center gap-2 px-4 text-[13px] font-medium rounded-md transition-all duration-150 active:scale-[0.97] ${
                  isActive
                    ? 'bg-[#185FA5]/10 text-[#185FA5] font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
                style={{ height: '34px', lineHeight: '24px' }}
              >
                <Icon size={15} className={isActive ? 'text-[#185FA5]' : 'text-zinc-400'} />
                {subtab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-[#F9FAFB]">
        <div className="mx-auto" style={{ maxWidth: '1400px' }}>
          {renderSubTabContent()}
        </div>
      </div>

      <ToolsIssueModal isOpen={isIssueModalOpen} onClose={() => setIsIssueModalOpen(false)} onSubmit={handleModalSubmit} organisation={organisation} />
      <ToolsReceiveModal isOpen={isReceiveModalOpen} onClose={() => setIsReceiveModalOpen(false)} onSubmit={handleModalSubmit} organisation={organisation} />
      <ToolsTransferModal isOpen={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)} onSubmit={handleModalSubmit} organisation={organisation} />
      <SiteTransferModal isOpen={isSiteTransferModalOpen} onClose={() => setIsSiteTransferModalOpen(false)} onSubmit={handleModalSubmit} organisation={organisation} />
    </div>
  );
}
