import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Folder, Plus, ClipboardList, Package, ArrowLeft, List, Calendar, BarChart3, Users, CheckSquare } from 'lucide-react';
import { supabase } from '../supabase';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../App';
import ProjectMaterialIntents from './ProjectMaterialIntents';
import ReceiveMaterial from './ReceiveMaterial';
import ProjectMaterialDashboard from './ProjectMaterialDashboard';
import MaterialIntentsList from './MaterialIntentsList';
import ProjectMaterialList from './ProjectMaterialList';
import MaterialUsageTracker from './MaterialUsageTracker';
import MaterialConsumptionReport from './MaterialConsumptionReport';
import { getMeetings } from '../meetings/api/meetings';
import ProjectTaskListView from '../components/tasks/ProjectTaskListView';

const ProjectList = React.lazy(() => import('./ProjectList'));
const CreateProject = React.lazy(() => import('./CreateProject'));
const DailyUpdates = React.lazy(() => import('./DailyUpdates'));
const SiteMaterials = React.lazy(() => import('./ProjectManagementInternal').then(m => ({ default: m.SiteMaterials })));

const TABS = [
  { id: 'list', label: 'Projects', icon: Folder, component: ProjectList },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare, component: null },
  { id: 'material-management', label: 'Material', icon: Package, component: null },
];

const MATERIAL_SUBTABS = [
  { id: 'all-intents', label: 'All Intents', icon: ClipboardList },
  { id: 'select-project', label: 'Select Project', icon: Folder },
];

function FileText() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>; }
function Truck() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>; }
function BarChart() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>; }

export default function Projects() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { organisation, user } = useAuth();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'list');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(searchParams.get('projectId'));
  const [projectName, setProjectName] = useState<string>(searchParams.get('projectName') || '');
  const [materialSubTab, setMaterialSubTab] = useState(searchParams.get('subtab') || 'select-project');

  const organisationId = organisation?.id || '';

  const { data: validProjectId } = useQuery({
    queryKey: ['validateProject', selectedProjectId, organisationId],
    queryFn: async () => {
      if (!selectedProjectId || !organisationId) return null;
      const { data } = await supabase
        .from('projects')
        .select('id')
        .eq('id', selectedProjectId)
        .eq('organisation_id', organisationId)
        .maybeSingle();
      return data?.id || null;
    },
    enabled: !!selectedProjectId && !!organisationId,
  });

  const safeProjectId = validProjectId !== undefined ? validProjectId : selectedProjectId;

  useEffect(() => {
    const tab = searchParams.get('tab') || 'list';
    setActiveTab(tab);
  }, [searchParams]);

  const handleTabChange = (tabId: string) => {
    setSearchParams({ tab: tabId });
    if (tabId !== 'material-management') {
      setSelectedProjectId(null);
    }
  };

  const handleSelectProject = (id: string, orgId: string, name: string) => {
    setSelectedProjectId(id);
    setProjectName(name);
    setSearchParams({ 
      tab: 'material-management', 
      subtab: 'select-project',
      projectId: id,
      projectName: name
    });
  };

  const handleBackToProjects = () => {
    setSelectedProjectId(null);
    setSearchParams({ tab: 'material-management', subtab: 'select-project' });
  };

  const handleMaterialSubTabChange = (subTabId: string) => {
    setMaterialSubTab(subTabId);
    setSelectedProjectId(null);
    setSearchParams({ tab: 'material-management', subtab: subTabId });
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
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Material Sub-tabs */}
            <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 24px' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                {MATERIAL_SUBTABS.map((subtab) => {
                  const Icon = subtab.icon;
                  const isActive = materialSubTab === subtab.id;
                  return (
                    <button
                      key={subtab.id}
                      onClick={() => handleMaterialSubTabChange(subtab.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 20px', border: 'none',
                        borderBottom: `2px solid ${isActive ? '#1d4ed8' : 'transparent'}`, background: 'transparent',
                        color: isActive ? '#1d4ed8' : '#6b7280', fontSize: '14px', fontWeight: isActive ? 600 : 500, cursor: 'pointer',
                      }}
                    >
                      <Icon size={18} />
                      {subtab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Material Sub-tab Content */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {materialSubTab === 'all-intents' ? (
                <MaterialIntentsList organisationId={organisationId} />
              ) : materialSubTab === 'select-project' ? (
                selectedProjectId ? (
                  <ProjectMaterialTabs 
                    projectId={safeProjectId || selectedProjectId}
                    organisationId={organisationId}
                    projectName={projectName}
                    onBack={handleBackToProjects}
                  />
                ) : (
                  <ProjectMaterialSelect onSelectProject={handleSelectProject} />
                )
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                  Select a sub-tab to continue
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'tasks' ? (
          <div style={{ flex: 1, overflow: 'auto' }}>
            <ProjectTaskListView
              organisationId={organisationId}
              userId={user?.id || ''}
              globalMode={true}
              projectName="All Tasks"
            />
          </div>
        ) : (
          <Suspense fallback={<div className="flex h-64 items-center justify-center text-zinc-400">Loading projects...</div>}>
            <ProjectList />
          </Suspense>
        )}
      </div>
    </div>
  );
}

function ProjectMaterialSelect({ onSelectProject }: { onSelectProject: (id: string, orgId: string, name: string) => void }) {
  const { organisation } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: projects = [] } = useQuery({
    queryKey: ['projects', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data } = await supabase.from('projects').select('*').eq('organisation_id', organisation.id).order('project_name');
      return data || [];
    },
    enabled: !!organisation?.id,
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

const MATERIAL_TAB_DEFS = [
  { id: 'intents', label: 'Raise Intent', Icon: FileText },
  { id: 'receive', label: 'Receive Material', Icon: Truck },
  { id: 'dashboard', label: 'Dashboard', Icon: BarChart },
  { id: 'material-list', label: 'Material List', Icon: List },
  { id: 'usage', label: 'Usage', Icon: Calendar },
  { id: 'consumption', label: 'Consumption Report', Icon: BarChart3 },
  { id: 'meetings', label: 'Meetings', Icon: Users },
];

function ProjectMaterialTabs({ projectId, organisationId, projectName, onBack }: { projectId: string; organisationId: string; projectName: string; onBack: () => void }) {
  const [activeSubTab, setActiveSubTab] = useState('intents');
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set(['intents']));

  const handleSubTabChange = (subTab: string) => {
    setActiveSubTab(subTab);
    setVisitedTabs(prev => {
      if (prev.has(subTab)) return prev;
      const next = new Set(prev);
      next.add(subTab);
      return next;
    });
  };

  const tabComponents = useMemo<Record<string, React.ReactNode>>(() => ({
    'intents': <ProjectMaterialIntents projectId={projectId} organisationId={organisationId} />,
    'receive': <ReceiveMaterial projectId={projectId} organisationId={organisationId} />,
    'dashboard': <ProjectMaterialDashboard projectId={projectId} organisationId={organisationId} projectName={projectName} isAdmin={true} />,
    'material-list': <ProjectMaterialList projectId={projectId} organisationId={organisationId} />,
    'usage': <MaterialUsageTracker projectId={projectId} organisationId={organisationId} />,
    'consumption': <MaterialConsumptionReport projectId={projectId} organisationId={organisationId} />,
    'meetings': <ProjectMeetings projectId={projectId} organisationId={organisationId} projectName={projectName} />,
  }), [projectId, organisationId, projectName]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={onBack} style={{ padding: '16px 12px', border: 'none', background: 'transparent', color: '#6b7280', cursor: 'pointer' }}>
            <ArrowLeft size={18} />
          </button>
          <div style={{ display: 'flex', gap: '4px' }}>
            {MATERIAL_TAB_DEFS.map(tab => {
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
        {MATERIAL_TAB_DEFS.map(tab =>
          visitedTabs.has(tab.id) && (
            <div key={tab.id} style={{ display: activeSubTab === tab.id ? 'block' : 'none' }}>
              {tabComponents[tab.id]}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function ProjectMeetings({ projectId, organisationId, projectName }: { projectId: string; organisationId: string; projectName: string }) {
  const navigate = useNavigate();
  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ['project-meetings', projectId],
    queryFn: () => getMeetings(organisationId, projectId),
    enabled: !!projectId && !!organisationId,
  });

  const handleCreateMeeting = () => {
    navigate(`/meetings/create?projectId=${projectId}`);
  };

  const handleViewMinutes = (meetingId: string) => {
    navigate(`/meetings/${meetingId}/minutes`);
  };

  const getStatusBadge = (status: string, minutesStatus: string) => {
    if (minutesStatus === 'finalized') {
      return <span style={{ padding: '4px 8px', borderRadius: '4px', background: '#d4edda', color: '#155724', fontSize: '12px' }}>Finalized</span>;
    }
    if (minutesStatus === 'draft') {
      return <span style={{ padding: '4px 8px', borderRadius: '4px', background: '#d1ecf1', color: '#0c5460', fontSize: '12px' }}>Draft</span>;
    }
    if (status === 'completed') {
      return <span style={{ padding: '4px 8px', borderRadius: '4px', background: '#e2e3e5', color: '#383d41', fontSize: '12px' }}>Completed</span>;
    }
    return <span style={{ padding: '4px 8px', borderRadius: '4px', background: '#fff3cd', color: '#856404', fontSize: '12px' }}>Upcoming</span>;
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '4px' }}>Project Meetings</h2>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>{projectName}</p>
        </div>
        <button
          onClick={handleCreateMeeting}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
            background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '6px',
            fontSize: '14px', fontWeight: 500, cursor: 'pointer'
          }}
        >
          <Plus size={16} />
          New Meeting
        </button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>Loading...</div>
      ) : meetings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
          <Users size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
          <p style={{ marginBottom: '16px' }}>No meetings scheduled for this project yet.</p>
          <button
            onClick={handleCreateMeeting}
            style={{
              padding: '10px 16px', background: '#1d4ed8', color: '#fff',
              border: 'none', borderRadius: '6px', fontSize: '14px', cursor: 'pointer'
            }}
          >
            Create First Meeting
          </button>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#374151' }}>Date</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#374151' }}>Client</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#374151' }}>Vendor</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#374151' }}>Location</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#374151' }}>Type</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#374151' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: '#374151' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((meeting: any) => (
                <tr key={meeting.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px 16px', fontSize: '14px', color: '#374151' }}>
                    {meeting.meeting_date}
                    {meeting.meeting_time && <span style={{ color: '#6b7280', marginLeft: '4px' }}>{meeting.meeting_time}</span>}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '14px', color: '#374151' }}>{meeting.client_name}</td>
                  <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6b7280' }}>{meeting.vendor_name || '-'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '14px', color: '#374151' }}>{meeting.location || '-'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '14px', color: '#374151', textTransform: 'capitalize' }}>{meeting.meeting_type}</td>
                  <td style={{ padding: '12px 16px' }}>{getStatusBadge(meeting.status, meeting.minutes_status)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleViewMinutes(meeting.id)}
                      style={{
                        padding: '6px 12px', background: '#f3f4f6', color: '#374151',
                        border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px',
                        cursor: 'pointer', marginRight: '4px'
                      }}
                    >
                      View Minutes
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}