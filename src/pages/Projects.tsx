import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Folder, Plus, ClipboardList, Package } from 'lucide-react';

// Lazy load the individual pages
const ProjectList = () => import('./ProjectList').then(m => ({ default: m.default }));
const CreateProject = () => import('./CreateProject').then(m => ({ default: m.default }));
const DailyUpdates = () => import('./DailyUpdates').then(m => ({ default: m.default }));
const SiteMaterials = () => import('./ProjectManagementInternal').then(m => ({ default: m.SiteMaterials }));

const TABS = [
  { id: 'list', label: 'List', icon: Folder, component: ProjectList },
  { id: 'new', label: 'New', icon: Plus, component: CreateProject },
  { id: 'daily-updates', label: 'Daily Updates', icon: ClipboardList, component: DailyUpdates },
  { id: 'site-materials', label: 'Site Materials', icon: Package, component: SiteMaterials },
];

export default function Projects() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'list');
  const [Component, setComponent] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    const tab = searchParams.get('tab') || 'list';
    setActiveTab(tab);
    
    // Load the component for the active tab
    const tabConfig = TABS.find(t => t.id === tab);
    if (tabConfig) {
      tabConfig.component().then(mod => {
        setComponent(() => mod.default);
      });
    }
  }, [searchParams]);

  const handleTabChange = (tabId: string) => {
    setSearchParams({ tab: tabId });
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Tab Navigation */}
      <div style={{ 
        background: '#fff', 
        borderBottom: '1px solid #e5e7eb',
        padding: '0 24px',
      }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '16px 20px',
                  border: 'none',
                  borderBottom: `2px solid ${isActive ? '#1d4ed8' : 'transparent'}`,
                  background: 'transparent',
                  color: isActive ? '#1d4ed8' : '#6b7280',
                  fontSize: '14px',
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflow: 'auto', background: '#f8fafc' }}>
        {Component && <Component />}
      </div>
    </div>
  );
}
