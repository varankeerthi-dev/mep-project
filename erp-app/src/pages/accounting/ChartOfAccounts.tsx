import React, { useState } from 'react';
import { Search, Plus, Folder, FileText, MoreHorizontal } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useChartOfAccounts, useCreateAccount } from './useAccounting';

interface AccountNode {
  id: string;
  code: string;
  name: string;
  type: 'Group' | 'Ledger';
  rootType: 'Asset' | 'Liability' | 'Income' | 'Expense';
  balance?: number;
  children?: AccountNode[];
}

const AccountRow: React.FC<{ node: AccountNode; depth: number }> = ({ node, depth }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <>
      <div 
        className={`flex items-center px-6 py-2 border-b border-[0.5px] hover:bg-gray-50 transition-colors ${node.type === 'Group' ? 'font-medium bg-gray-50/50' : ''}`}
        style={{ paddingLeft: `${(depth * 24) + 24}px` }}
      >
        <div className="flex items-center gap-2 w-[400px]">
          {node.type === 'Group' ? (
            <button onClick={() => setIsExpanded(!isExpanded)} className="text-gray-500 hover:text-gray-900">
              <Folder className="w-4 h-4 fill-current text-blue-100 stroke-blue-600" />
            </button>
          ) : (
            <div className="pl-6">
              <FileText className="w-4 h-4 text-gray-400" />
            </div>
          )}
          <span className="text-[12px] font-mono text-gray-500 w-[60px]">{node.code}</span>
          <span className="text-[13px] text-gray-900">{node.name}</span>
        </div>
        
        <div className="w-[120px] text-[12px] text-gray-500">{node.rootType}</div>
        
        <div className="flex-1 text-right tabular-nums text-[13px]">
          {node.balance ? node.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
        </div>
        
        <div className="w-[80px] flex justify-end">
          <button className="p-1 text-gray-400 hover:text-gray-900 rounded">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {isExpanded && node.children?.map(child => (
        <AccountRow key={child.id} node={child} depth={depth + 1} />
      ))}
    </>
  );
};

export const ChartOfAccounts: React.FC = () => {
  const { data: coaTree = [], isLoading } = useChartOfAccounts();
  const createAccount = useCreateAccount();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'Group' | 'Ledger'>('Group');

  const [formData, setFormData] = useState({
    account_code: '',
    name: '',
    root_type: 'Asset',
    parent_id: '',
  });

  const handleOpenModal = (type: 'Group' | 'Ledger') => {
    setModalType(type);
    setFormData({ account_code: '', name: '', root_type: 'Asset', parent_id: '' });
    setIsModalOpen(true);
  };

  const handleCreate = async () => {
    await createAccount.mutateAsync({
      ...formData,
      is_group: modalType === 'Group',
      parent_id: formData.parent_id || null
    });
    setIsModalOpen(false);
  };

  // Flatten tree for parent selection
  const flattenGroups = (nodes: any[]): any[] => {
    let result: any[] = [];
    nodes.forEach(node => {
      if (node.type === 'Group') {
        result.push(node);
        if (node.children) {
          result = result.concat(flattenGroups(node.children));
        }
      }
    });
    return result;
  };

  const groupOptions = flattenGroups(coaTree);

  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-[14px] border-b border-[0.5px]">
        <h1 className="text-[16px] font-medium text-primary">Chart of Accounts</h1>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-[14px] h-[14px] absolute left-[8px] top-1/2 -translate-y-1/2 text-tertiary" />
            <input 
              type="text" 
              placeholder="Search accounts..." 
              className="h-[32px] w-[220px] pl-[28px] pr-[10px] py-[5px] rounded-[8px] border text-[13px] border-gray-200"
            />
          </div>
          <button 
            onClick={() => handleOpenModal('Group')}
            className="h-[32px] px-[14px] py-[6px] bg-white border text-gray-700 rounded-[8px] text-[13px] font-medium flex items-center gap-[6px]"
          >
            <Folder className="w-4 h-4" /> New Group
          </button>
          <button 
            onClick={() => handleOpenModal('Ledger')}
            className="h-[32px] px-[14px] py-[6px] bg-black text-white rounded-[8px] text-[13px] font-medium flex items-center gap-[6px]"
          >
            <Plus className="w-4 h-4" /> New Ledger
          </button>
        </div>
      </div>

      {/* Table Header */}
      <div className="flex items-center px-6 py-[7px] border-b border-[0.5px] bg-secondary/30 text-[11px] font-medium text-gray-500 uppercase tracking-[0.04em]">
        <div className="w-[400px]">Account Name</div>
        <div className="w-[120px]">Root Type</div>
        <div className="flex-1 text-right">Closing Balance (₹)</div>
        <div className="w-[80px]"></div>
      </div>

      {/* Data Tree */}
      <div className="flex-1 overflow-auto pb-10">
        {isLoading ? (
          <div className="p-6 text-center text-gray-500 text-[13px]">Loading accounts...</div>
        ) : coaTree.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-[13px]">No accounts found. Add your first group or ledger.</div>
        ) : (
          coaTree.map((node: any) => (
            <AccountRow key={node.id} node={node} depth={0} />
          ))
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Create New ${modalType}`}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Code</label>
            <input 
              type="text" 
              className="w-full border rounded p-2 text-sm"
              value={formData.account_code}
              onChange={e => setFormData(f => ({ ...f, account_code: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
            <input 
              type="text" 
              className="w-full border rounded p-2 text-sm"
              value={formData.name}
              onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Root Type</label>
            <select 
              className="w-full border rounded p-2 text-sm bg-white"
              value={formData.root_type}
              onChange={e => setFormData(f => ({ ...f, root_type: e.target.value }))}
            >
              <option value="Asset">Asset</option>
              <option value="Liability">Liability</option>
              <option value="Income">Income</option>
              <option value="Expense">Expense</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parent Group (Optional)</label>
            <select 
              className="w-full border rounded p-2 text-sm bg-white"
              value={formData.parent_id}
              onChange={e => setFormData(f => ({ ...f, parent_id: e.target.value }))}
            >
              <option value="">None (Top Level)</option>
              {groupOptions.map(g => (
                <option key={g.id} value={g.id}>{g.code} - {g.name}</option>
              ))}
            </select>
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded text-sm font-medium">Cancel</button>
            <button 
              onClick={handleCreate}
              disabled={createAccount.isPending || !formData.account_code || !formData.name}
              className="px-4 py-2 bg-black text-white rounded text-sm font-medium disabled:opacity-50"
            >
              {createAccount.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ChartOfAccounts;
