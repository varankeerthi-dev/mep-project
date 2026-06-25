import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LeadsListView } from './components/LeadsListView';
import { LeadsKanbanView } from './components/LeadsKanbanView';
import { LeadStatusConfig } from './components/LeadStatusConfig';
import { LeadIndustryConfig } from './components/LeadIndustryConfig';
import { LeadAssignmentConfig } from './components/LeadAssignmentConfig';

const TABS = [
  { key: 'list', label: 'List View' },
  { key: 'kanban', label: 'Kanban' },
  { key: 'settings', label: 'Settings' },
] as const;

export const LeadsModule: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes('/leads/kanban')) return 'kanban';
    if (path.includes('/leads/settings')) return 'settings';
    return 'list';
  };

  const activeTab = getActiveTab();

  const handleTabChange = (tab: string) => {
    switch (tab) {
      case 'kanban': navigate('/leads/kanban'); break;
      case 'settings': navigate('/leads/settings'); break;
      default: navigate('/leads');
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'kanban': return <LeadsKanbanView />;
      case 'settings': return <SettingsView />;
      default: return <LeadsListView />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50">
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 bg-white">
        <h1 style={{ fontSize: '15px', fontWeight: 700, color: '#18181b' }}>Leads</h1>
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
      </div>
      <div className="flex-1 overflow-auto">
        {renderContent()}
      </div>
    </div>
  );
};

const SettingsView: React.FC = () => {
  const [activeSetting, setActiveSetting] = React.useState<'statuses' | 'industries' | 'assignment'>('statuses');

  const settingTabs = [
    { key: 'statuses' as const, label: 'Lead Statuses' },
    { key: 'industries' as const, label: 'Industries' },
    { key: 'assignment' as const, label: 'Assignment Rules' },
  ];

  return (
    <div className="p-6">
      <div className="flex gap-2 mb-6 border-b border-zinc-200 pb-3">
        {settingTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSetting(tab.key)}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: activeSetting === tab.key ? 600 : 500,
              color: activeSetting === tab.key ? '#185FA5' : '#6B7280',
              background: 'transparent',
              border: 'none',
              borderBottom: activeSetting === tab.key ? '2px solid #185FA5' : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeSetting === 'statuses' && <LeadStatusConfig />}
      {activeSetting === 'industries' && <LeadIndustryConfig />}
      {activeSetting === 'assignment' && <LeadAssignmentConfig />}
    </div>
  );
};

export default LeadsModule;
