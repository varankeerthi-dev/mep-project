import { useState, useEffect, Suspense, lazy } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Folder, Plus, ClipboardList, Package, ArrowLeft } from 'lucide-react';
import { supabase } from '../supabase';
import { useQuery } from '@tanstack/react-query';

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

function FileText() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>; }
function Truck() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>; }
function BarChart() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>; }

export default function Projects() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'list');
  const [Component, setComponent] = useState<React.ComponentType | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [organisationId, setOrganisationId] = useState<string>('');
  const [projectName, setProjectName] = useState<string>('');

  useEffect(() => {
    const tab = searchParams.get('tab') || 'list';
    setActiveTab(tab);
    
    const tabConfig = TABS.find(t => t.id === tab);
    if (tabConfig) {
      tabConfig.component().then(mod => {
        setComponent(() => mod.default);
      });
    } else if (tab === 'material-management') {
      setComponent(null);
    } else {
      setComponent(null);
    }
  }, [searchParams]);

  const handleTabChange = (tabId: string) => {
    setSearchParams({ tab: tabId });
    if (tabId !== 'material-management') {
      setSelectedProjectId(null);
    }
  };

  const handleSelectProject = (id: string, orgId: string, name: string) => {
    setSelectedProjectId(id);
    setOrganisationId(orgId);
    setProjectName(name);
    setSearchParams({ tab: 'material-management', subtab: 'intents' });
  };

  const handleBackToProjects = () => {
    setSelectedProjectId(null);
    setSearchParams({ tab: 'material-management' });
  };

  const isMaterialManagement = activeTab === 'material-management';

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 24px' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 20px', border: 'none',
                  borderBottom: `2px solid ${isActive ? '#1d4ed8' : 'transparent'}`, background: 'transparent',
                  color: isActive ? '#1d4ed8' : '#6b7280', fontSize: '14px', fontWeight: isActive ? 600 : 500, cursor: 'pointer',
                }}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', background: '#f8fafc' }}>
        {isMaterialManagement ? (
          selectedProjectId ? (
            <ProjectMaterialTabs 
              projectId={selectedProjectId}
              organisationId={organisationId}
              projectName={projectName}
              onBack={handleBackToProjects}
            />
          ) : (
            <ProjectMaterialSelect onSelectProject={handleSelectProject} />
          )
        ) : (
          Component && <Component />
        )}
      </div>
    </div>
  );
}

function ProjectMaterialSelect({ onSelectProject }: { onSelectProject: (id: string, orgId: string, name: string) => void }) {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('*').order('project_name');
      return data || [];
    },
  });

  const filteredProjects = projects.filter(p => 
    !searchTerm || p.project_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ padding: '24px' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Project Material Management</h2>
      <p style={{ color: '#6b7280', marginBottom: '20px' }}>Select a project to manage material intents, receipts, and budget.</p>
      
      <input
        type="text"
        placeholder="Search projects..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ width: '100%', maxWidth: '400px', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', marginBottom: '16px' }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {filteredProjects.map(project => (
          <div
            key={project.id}
            onClick={() => onSelectProject(project.id, project.organisation_id || '', project.project_name || 'Unnamed')}
            style={{ padding: '20px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer' }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>{project.project_name}</h3>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>{project.project_code && <span>Code: {project.project_code}</span>}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectMaterialTabs({ projectId, organisationId, projectName, onBack }: { projectId: string; organisationId: string; projectName: string; onBack: () => void }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSubTab = searchParams.get('subtab') || 'intents';

  const handleSubTabChange = (subTab: string) => {
    setSearchParams({ tab: 'material-management', subtab: subTab });
  };

  const IntentComponent = lazy(() => import('./ProjectMaterialIntents').then(m => ({ default: m.default })));
  const ReceiveComponent = lazy(() => import('./ReceiveMaterial').then(m => ({ default: m.default })));
  const DashboardComponent = lazy(() => import('./ProjectMaterialDashboard').then(m => ({ default: m.default })));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={onBack} style={{ padding: '16px 12px', border: 'none', background: 'transparent', color: '#6b7280', cursor: 'pointer' }}>
            <ArrowLeft size={18} />
          </button>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[
              { id: 'intents', label: 'Raise Intent', Icon: FileText },
              { id: 'receive', label: 'Receive Material', Icon: Truck },
              { id: 'dashboard', label: 'Dashboard', Icon: BarChart },
            ].map(tab => {
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleSubTabChange(tab.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 20px', border: 'none',
                    borderBottom: `2px solid ${isActive ? '#1d4ed8' : 'transparent'}`, background: 'transparent',
                    color: isActive ? '#1d4ed8' : '#6b7280', fontSize: '14px', fontWeight: isActive ? 600 : 500, cursor: 'pointer',
                  }}
                >
                  <tab.Icon />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>}>
          {activeSubTab === 'intents' && <IntentComponent projectId={projectId} organisationId={organisationId} />}
          {activeSubTab === 'receive' && <ReceiveComponent projectId={projectId} organisationId={organisationId} />}
          {activeSubTab === 'dashboard' && <DashboardComponent projectId={projectId} organisationId={organisationId} projectName={projectName} isAdmin={true} />}
        </Suspense>
      </div>
    </div>
  );
}