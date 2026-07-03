import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AdvanceExpenseList } from './components/AdvanceExpenseList';
import { AdvanceExpenseForm } from './components/AdvanceExpenseForm';
import { AdvanceExpenseDetail } from './components/AdvanceExpenseDetail';
import { AdvanceExpenseReports } from './components/AdvanceExpenseReports';
import { PettyCashManagement } from './components/PettyCashManagement';
import { CeoDashboard } from './components/CeoDashboard';

const TABS = [
  { key: 'list', label: 'All Entries' },
  { key: 'advances', label: 'Advances' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'reimbursements', label: 'Reimbursements' },
  { key: 'petty-cash', label: 'Petty Cash' },
  { key: 'ceo-view', label: 'CEO Dashboard' },
  { key: 'reports', label: 'Reports' },
] as const;

export const AdvanceExpenseModule: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, organisation } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const queryParams = new URLSearchParams(location.search);
  const tabFromUrl = queryParams.get('tab') || 'list';

  const getActiveTab = () => {
    if (location.pathname.includes('/advances-expenses/reports')) return 'reports';
    if (location.pathname.includes('/advances-expenses/petty-cash')) return 'petty-cash';
    if (location.pathname.includes('/advances-expenses/ceo-view')) return 'ceo-view';
    if (TABS.find(t => t.key === tabFromUrl)) return tabFromUrl;
    return 'list';
  };

  const activeTab = getActiveTab();

  const handleTabChange = (tab: string) => {
    navigate(`/advances-expenses?tab=${tab}`);
  };

  const handleCreate = () => {
    setEditId(null);
    setFormOpen(true);
  };

  const handleEdit = (id: string) => {
    setEditId(id);
    setFormOpen(true);
  };

  const handleView = (id: string) => {
    setDetailId(id);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditId(null);
  };

  const handleDetailClose = () => {
    setDetailId(null);
  };

  const renderContent = () => {
    if (detailId) {
      return (
        <AdvanceExpenseDetail
          id={detailId}
          onClose={handleDetailClose}
          onEdit={handleEdit}
        />
      );
    }

    if (formOpen) {
      return (
        <AdvanceExpenseForm
          editId={editId}
          onClose={handleFormClose}
        />
      );
    }

    switch (activeTab) {
      case 'advances':
        return <AdvanceExpenseList typeFilter="ADVANCE" onCreate={handleCreate} onView={handleView} onEdit={handleEdit} />;
      case 'expenses':
        return <AdvanceExpenseList typeFilter="EXPENSE" onCreate={handleCreate} onView={handleView} onEdit={handleEdit} />;
      case 'reimbursements':
        return <AdvanceExpenseList typeFilter="REIMBURSEMENT" onCreate={handleCreate} onView={handleView} onEdit={handleEdit} />;
      case 'petty-cash':
        return <PettyCashManagement />;
      case 'ceo-view':
        return <CeoDashboard onView={handleView} />;
      case 'reports':
        return <AdvanceExpenseReports />;
      default:
        return <AdvanceExpenseList onCreate={handleCreate} onView={handleView} onEdit={handleEdit} />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50">
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 bg-white">
        <h1 style={{ fontSize: '15px', fontWeight: 700, color: '#18181b' }}>Advances & Expenses</h1>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: activeTab === tab.key ? 600 : 500,
                  color: activeTab === tab.key ? '#fff' : '#374151',
                  background: activeTab === tab.key ? '#185FA5' : '#fff',
                  border: activeTab === tab.key ? '1px solid #185FA5' : '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {activeTab !== 'petty-cash' && activeTab !== 'ceo-view' && activeTab !== 'reports' && (
            <button
              onClick={handleCreate}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#fff',
                background: '#185FA5',
                border: '1px solid #185FA5',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              + New
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {renderContent()}
      </div>
    </div>
  );
};

export default AdvanceExpenseModule;
