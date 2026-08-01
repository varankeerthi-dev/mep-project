import { useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import ManufacturingDashboard from '../manufacturing/ManufacturingDashboard';
import InventoryReport from '../manufacturing/InventoryReport';
import BOMList from './BOMList';
import BOMEditor from './BOMEditor';
import ProductionScheduleList from '../manufacturing/ProductionScheduleList';
import ProductionScheduleEditor from '../manufacturing/ProductionScheduleEditor';
import JobCardList from './JobCardList';
import JobCardCreate from './JobCardCreate';
import JobCardDetail from './JobCardDetail';
import ProductionEntryForm from './ProductionEntryForm';
import CustomUnits from '../manufacturing/CustomUnits';
import CustomFields from '../manufacturing/CustomFields';
import ActivityLog from '../manufacturing/ActivityLog';

type Tab = {
  id: string;
  label: string;
  path: string;
  matchPrefix: string;
};

const TABS: Tab[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/manufacturing-v0', matchPrefix: '/manufacturing-v0' },
  { id: 'inventory', label: 'Inventory', path: '/manufacturing-v0/inventory', matchPrefix: '/manufacturing-v0/inventory' },
  { id: 'boms', label: 'BOMs', path: '/manufacturing-v0/boms', matchPrefix: '/manufacturing-v0/boms' },
  { id: 'schedules', label: 'Schedules', path: '/manufacturing-v0/schedules', matchPrefix: '/manufacturing-v0/schedules' },
  { id: 'job-cards', label: 'Job Cards', path: '/manufacturing-v0/job-cards', matchPrefix: '/manufacturing-v0/job-cards' },
  { id: 'production', label: 'Production', path: '/manufacturing-v0/production', matchPrefix: '/manufacturing-v0/production' },
  { id: 'activity', label: 'Activity Log', path: '/manufacturing-v0/activity-log', matchPrefix: '/manufacturing-v0/activity-log' },
  { id: 'settings', label: 'Settings', path: '/manufacturing-v0/custom-units', matchPrefix: '/manufacturing-v0/custom-units' },
];

export const MANUFACTURING_QUERY_KEYS = [
  'manufacturing-dashboard',
  'boms',
  'job-cards',
  'production-schedules',
  'production-entries',
  'manufacturing-units',
  'manufacturing-custom-fields',
  'manufacturing-activity-log',
  'manufacturing-inventory',
];

export function useInvalidateManufacturing() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: MANUFACTURING_QUERY_KEYS });
  }, [queryClient]);
}

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

type PanelProps = { children: React.ReactNode; active: boolean };
function Panel({ children, active }: PanelProps) {
  return <div style={{ display: active ? '' : 'none' }}>{children}</div>;
}

export default function ManufacturingShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathKey = location.pathname;
  const queryClient = useQueryClient();

  const activeTab = useMemo(() => {
    const exact = TABS.find(t => pathKey === t.path);
    if (exact) return exact;
    const best = TABS.filter(t => t.id !== 'dashboard').find(t => pathKey.startsWith(t.matchPrefix + '/'));
    return best || TABS[0];
  }, [pathKey]);

  const handleTabClick = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  // v0 is preserved under /manufacturing-v0 — rewrite page navigations to stay inside v0
  const navigateV0 = useCallback((path: string) => {
    navigate(path.replace('/manufacturing', '/manufacturing-v0'));
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#f8f9fb] font-['Inter']">
      <div className="sticky top-0 z-40 bg-white border-b border-zinc-200 shadow-[0_1px_3px_-1px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3 px-6 overflow-x-auto">
          {TABS.map(tab => {
            const isActive = tab.id === activeTab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.path)}
                className={cx(
                  'relative px-3 py-1 text-base font-medium whitespace-nowrap transition-all duration-150 rounded-md',
                  isActive
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100'
                )}
                type="button"
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <Panel active={activeTab.id === 'dashboard' || (!activeTab && pathKey === '/manufacturing-v0')}>
        <ManufacturingDashboard onNavigate={navigateV0} />
      </Panel>

      <Panel active={activeTab.id === 'inventory'}>
        <InventoryReport onNavigate={navigateV0} />
      </Panel>

      <Panel active={activeTab.id === 'boms'}>
        {pathKey === '/manufacturing-v0/boms' ? (
          <BOMList onNavigate={navigateV0} />
        ) : (
          <BOMEditor
            onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['boms'] }); navigate('/manufacturing-v0/boms'); }}
            onCancel={() => navigate('/manufacturing-v0/boms')}
          />
        )}
      </Panel>

      <Panel active={activeTab.id === 'schedules'}>
        {pathKey === '/manufacturing-v0/schedules' ? (
          <ProductionScheduleList onNavigate={navigateV0} />
        ) : (
          <ProductionScheduleEditor
            onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['production-schedules'] }); navigate('/manufacturing-v0/schedules'); }}
            onCancel={() => navigate('/manufacturing-v0/schedules')}
          />
        )}
      </Panel>

      <Panel active={activeTab.id === 'job-cards'}>
        {pathKey === '/manufacturing-v0/job-cards' ? (
          <JobCardList onNavigate={navigateV0} />
        ) : pathKey === '/manufacturing-v0/job-cards/create' ? (
          <JobCardCreate
            onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['job-cards'] }); navigate('/manufacturing-v0/job-cards'); }}
            onCancel={() => navigate('/manufacturing-v0/job-cards')}
          />
        ) : (
          <JobCardDetail jobCardId={pathKey.split('/manufacturing-v0/job-cards/')[1]} onNavigate={navigateV0} />
        )}
      </Panel>

      <Panel active={activeTab.id === 'production'}>
        <ProductionEntryForm onNavigate={navigateV0} />
      </Panel>

      <Panel active={activeTab.id === 'activity'}>
        <ActivityLog onNavigate={navigateV0} />
      </Panel>

      <Panel active={activeTab.id === 'settings'}>
        {pathKey === '/manufacturing-v0/custom-units' ? (
          <CustomUnits onNavigate={navigateV0} />
        ) : (
          <CustomFields onNavigate={navigateV0} />
        )}
      </Panel>
    </div>
  );
}
