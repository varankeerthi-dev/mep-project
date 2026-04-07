import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { Folder, Plus, ClipboardList, Package, Truck, BarChart3, FileText } from 'lucide-react';
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

const MATERIAL_TABS = [
  { id: 'intents', label: 'Raise Intent', icon: FileText },
  { id: 'receive', label: 'Receive Material', icon: Truck },
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
];

export default function Projects() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'list');
  const [Component, setComponent] = useState<React.ComponentType | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [organisationId, setOrganisationId] = useState<string>('');
  const [projectName, setProjectName] = useState<string>('');

  useEffect(() => {
    const tab = searchParams.get('tab') || 'list';
    setActiveTab(tab);
    
    if (tab === 'material-management') {
      setComponent(() => () => (
        <ProjectMaterialManagement 
          onSelectProject={(id, orgId, name) => {
            setSelectedProjectId(id);
            setOrganisationId(orgId);
            setProjectName(name);
          }}
        />
      ));
    } else {
      const tabConfig = TABS.find(t => t.id === tab);
      if (tabConfig) {
        tabConfig.component().then(mod => {
          setComponent(() => mod.default);
        });
      }
    }
  }, [searchParams]);

  const handleTabChange = (tabId: string) => {
    setSearchParams({ tab: tabId });
    if (tabId !== 'material-management') {
      setSelectedProjectId(null);
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
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

      <div style={{ flex: 1, overflow: 'auto', background: '#f8fafc' }}>
        {activeTab === 'material-management' && selectedProjectId ? (
          <ProjectMaterialTabs 
            projectId={selectedProjectId}
            organisationId={organisationId}
            projectName={projectName}
          />
        ) : (
          Component && <Component />
        )}
      </div>
    </div>
  );
}

function ProjectMaterialManagement({ onSelectProject }: { onSelectProject: (id: string, orgId: string, name: string) => void }) {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('*').order('project_name');
      return data || [];
    },
  });

  useEffect(() => {
    import('@tanstack/react-query').then(() => {});
  }, []);

  const filteredProjects = useMemo(() => {
    if (!searchTerm) return projects;
    return projects.filter(p => 
      p.project_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [projects, searchTerm]);

  return (
    <div style={{ padding: '24px' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Project Material Management</h2>
      <p style={{ color: '#6b7280', marginBottom: '20px' }}>Select a project to manage its material intents, receipts, and budget tracking.</p>
      
      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          placeholder="Search projects..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '400px',
            padding: '10px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '14px',
          }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {filteredProjects.map(project => (
          <div
            key={project.id}
            onClick={() => onSelectProject(project.id, project.organisation_id || '', project.project_name || 'Unnamed Project')}
            style={{
              padding: '20px',
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>{project.project_name}</h3>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>
              {project.project_code && <span>Code: {project.project_code}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectMaterialTabs({ projectId, organisationId, projectName }: { projectId: string; organisationId: string; projectName: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSubTab = searchParams.get('subtab') || 'intents';

  const handleSubTabChange = (subTab: string) => {
    setSearchParams({ tab: 'material-management', subtab: subTab });
  };

  const renderContent = () => {
    switch (activeSubTab) {
      case 'intents':
        const ProjectMaterialIntents = () => import('./ProjectMaterialIntents').then(m => ({ default: m.default }));
        const IntentsComponent = ProjectMaterialIntents();
        return <IntentsComponentWrapper Component={IntentsComponent} projectId={projectId} organisationId={organisationId} />;
      case 'receive':
        const ReceiveMaterial = () => import('./ReceiveMaterial').then(m => ({ default: m.default }));
        const ReceiveComponent = ReceiveMaterial();
        return <ReceiveMaterialWrapper Component={ReceiveComponent} projectId={projectId} organisationId={organisationId} />;
      case 'dashboard':
        const ProjectMaterialDashboard = () => import('./ProjectMaterialDashboard').then(m => ({ default: m.default }));
        const DashboardComponent = ProjectMaterialDashboard();
        return <DashboardWrapper Component={DashboardComponent} projectId={projectId} organisationId={organisationId} projectName={projectName} />;
      default:
        return null;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => setSearchParams({ tab: 'material-management' })}
            style={{
              padding: '16px 12px',
              border: 'none',
              background: 'transparent',
              color: '#6b7280',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            ← Back
          </button>
          <div style={{ display: 'flex', gap: '4px' }}>
            {MATERIAL_TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleSubTabChange(tab.id)}
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
                  }}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {renderContent()}
      </div>
    </div>
  );
}

function IntentsComponentWrapper({ Component, projectId, organisationId }: { Component: any; projectId: string; organisationId: string }) {
  const [LoadedComponent, setLoadedComponent] = useState<React.ComponentType<any> | null>(null);
  
  useEffect(() => {
    Component().then((mod: any) => {
      setLoadedComponent(() => mod.default);
    });
  }, [Component]);

  if (!LoadedComponent) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
  return <LoadedComponent projectId={projectId} organisationId={organisationId} />;
}

function ReceiveMaterialWrapper({ Component, projectId, organisationId }: { Component: any; projectId: string; organisationId: string }) {
  const [LoadedComponent, setLoadedComponent] = useState<React.ComponentType<any> | null>(null);
  
  useEffect(() => {
    Component().then((mod: any) => {
      setLoadedComponent(() => mod.default);
    });
  }, [Component]);

  if (!LoadedComponent) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
  return <LoadedComponent projectId={projectId} organisationId={organisationId} />;
}

function DashboardWrapper({ Component, projectId, organisationId, projectName }: { Component: any; projectId: string; organisationId: string; projectName: string }) {
  const [LoadedComponent, setLoadedComponent] = useState<React.ComponentType<any> | null>(null);
  
  useEffect(() => {
    Component().then((mod: any) => {
      setLoadedComponent(() => mod.default);
    });
  }, [Component]);

  if (!LoadedComponent) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
  return <LoadedComponent projectId={projectId} organisationId={organisationId} projectName={projectName} isAdmin={true} />;
}