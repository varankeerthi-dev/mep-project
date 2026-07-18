import { useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import ManufacturingDashboard from './ManufacturingDashboard';
import InventoryReport from './InventoryReport';
import BOMList from './BOMList';
import BOMEditor from './BOMEditor';
import ProductionScheduleList from './ProductionScheduleList';
import ProductionScheduleEditor from './ProductionScheduleEditor';
import JobCardList from './JobCardList';
import JobCardCreate from './JobCardCreate';
import JobCardDetail from './JobCardDetail';
import ProductionEntryForm from './ProductionEntryForm';
import CustomUnits from './CustomUnits';
import CustomFields from './CustomFields';
import ActivityLog from './ActivityLog';

type Tab = {
  id: string;
  label: string;
  path: string;
  matchPrefix: string;
};

const TABS: Tab[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/manufacturing', matchPrefix: '/manufacturing' },
  { id: 'inventory', label: 'Inventory', path: '/manufacturing/inventory', matchPrefix: '/manufacturing/inventory' },
  { id: 'boms', label: 'BOMs', path: '/manufacturing/boms', matchPrefix: '/manufacturing/boms' },
  { id: 'schedules', label: 'Schedules', path: '/manufacturing/schedules', matchPrefix: '/manufacturing/schedules' },
  { id: 'job-cards', label: 'Job Cards', path: '/manufacturing/job-cards', matchPrefix: '/manufacturing/job-cards' },
  { id: 'production', label: 'Production', path: '/manufacturing/production', matchPrefix: '/manufacturing/production' },
  { id: 'activity', label: 'Activity Log', path: '/manufacturing/activity-log', matchPrefix: '/manufacturing/activity-log' },
  { id: 'settings', label: 'Settings', path: '/manufacturing/custom-units', matchPrefix: '/manufacturing/custom-units' },
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

      <Panel active={activeTab.id === 'dashboard' || (!activeTab && pathKey === '/manufacturing')}>
        <ManufacturingDashboard onNavigate={navigate} />
      </Panel>

      <Panel active={activeTab.id === 'inventory'}>
        <InventoryReport onNavigate={navigate} />
      </Panel>

      <Panel active={activeTab.id === 'boms'}>
        {pathKey === '/manufacturing/boms' ? (
          <BOMList onNavigate={navigate} />
        ) : (
          <BOMEditor
            onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['boms'] }); navigate('/manufacturing/boms'); }}
            onCancel={() => navigate('/manufacturing/boms')}
          />
        )}
      </Panel>

      <Panel active={activeTab.id === 'schedules'}>
        {pathKey === '/manufacturing/schedules' ? (
          <ProductionScheduleList onNavigate={navigate} />
        ) : (
          <ProductionScheduleEditor
            onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['production-schedules'] }); navigate('/manufacturing/schedules'); }}
            onCancel={() => navigate('/manufacturing/schedules')}
          />
        )}
      </Panel>

      <Panel active={activeTab.id === 'job-cards'}>
        {pathKey === '/manufacturing/job-cards' ? (
          <JobCardList onNavigate={navigate} />
        ) : pathKey === '/manufacturing/job-cards/create' ? (
          <JobCardCreate
            onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['job-cards'] }); navigate('/manufacturing/job-cards'); }}
            onCancel={() => navigate('/manufacturing/job-cards')}
          />
        ) : (
          <JobCardDetail jobCardId={pathKey.split('/manufacturing/job-cards/')[1]} onNavigate={navigate} />
        )}
      </Panel>

      <Panel active={activeTab.id === 'production'}>
        <ProductionEntryForm onNavigate={navigate} />
      </Panel>

      <Panel active={activeTab.id === 'activity'}>
        <ActivityLog onNavigate={navigate} />
      </Panel>

      <Panel active={activeTab.id === 'settings'}>
        {pathKey === '/manufacturing/custom-units' ? (
          <CustomUnits onNavigate={navigate} />
        ) : (
          <CustomFields onNavigate={navigate} />
        )}
      </Panel>
    </div>
  );
}
