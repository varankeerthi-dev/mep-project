import { useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { SubTabsNav } from '../../components/ui/SubTabsNav';

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

// New gap feature components
import DispatchList from './dispatch/DispatchList';
import DispatchCreate from './dispatch/DispatchCreate';
import DispatchDetail from './dispatch/DispatchDetail';
import StoresDashboard from './stores/StoresDashboard';
import RequisitionDetail from './stores/RequisitionDetail';
import GRNCreate from './stores/GRNCreate';
import GRNDetail from './stores/GRNDetail';
import QCInspectionList from './qc/QCInspectionList';
import QCInspectionCreate from './qc/QCInspectionCreate';
import QCInspectionDetail from './qc/QCInspectionDetail';
import QCParameters from './qc/QCParameters';
import ProductionPlanList from './plans/ProductionPlanList';
import ProductionPlanCreate from './plans/ProductionPlanCreate';
import ProductionPlanDetail from './plans/ProductionPlanDetail';
import WorkCenterList from './work-centers/WorkCenterList';
import IPQCDashboard from './qc/IPQCDashboard';
import IPQCCheckpointConfig from './qc/IPQCCheckpointConfig';
import WIPValuationReport from './inventory/WIPValuationReport';

import MachineBoardPage from './machine-board/MachineBoardPage';
import MouldList from './MouldList';

type Tab = {
  id: string;
  label: string;
  path: string;
  matchPrefix: string;
};

const TABS: Tab[] = [
  { id: 'machines', label: 'Machine Board', path: '/manufacturing', matchPrefix: '/manufacturing/machines' },
  { id: 'moulds', label: 'Moulds', path: '/manufacturing/moulds', matchPrefix: '/manufacturing/moulds' },
  { id: 'dashboard', label: 'Dashboard', path: '/manufacturing/dashboard', matchPrefix: '/manufacturing/dashboard' },
  { id: 'inventory', label: 'Inventory', path: '/manufacturing/inventory', matchPrefix: '/manufacturing/inventory' },
  { id: 'boms', label: 'BOMs', path: '/manufacturing/boms', matchPrefix: '/manufacturing/boms' },
  { id: 'schedules', label: 'Schedules', path: '/manufacturing/schedules', matchPrefix: '/manufacturing/schedules' },
  { id: 'job-cards', label: 'Job Cards', path: '/manufacturing/job-cards', matchPrefix: '/manufacturing/job-cards' },
  { id: 'production', label: 'Production', path: '/manufacturing/production', matchPrefix: '/manufacturing/production' },
  { id: 'plans', label: 'Planning (MRP)', path: '/manufacturing/plans', matchPrefix: '/manufacturing/plans' },
  { id: 'dispatch', label: 'Dispatch', path: '/manufacturing/dispatch', matchPrefix: '/manufacturing/dispatch' },
  { id: 'stores', label: 'Stores Console', path: '/manufacturing/stores', matchPrefix: '/manufacturing/stores' },
  { id: 'qc', label: 'QC Inspections', path: '/manufacturing/qc', matchPrefix: '/manufacturing/qc' },
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

  const navigateV2 = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#f8f9fb] font-['Inter']">
      <div className="w-full max-w-[1200px] mx-auto px-4 pt-3">
        <SubTabsNav tabs={TABS} activeTabId={activeTab.id} />

      <Panel active={activeTab.id === 'machines' || (!activeTab && pathKey === '/manufacturing')}>
        <MachineBoardPage onNavigate={navigateV2} />
      </Panel>

      <Panel active={activeTab.id === 'moulds'}>
        <MouldList onNavigate={navigateV2} />
      </Panel>

      <Panel active={activeTab.id === 'dashboard'}>
        <ManufacturingDashboard onNavigate={navigateV2} />
      </Panel>

      <Panel active={activeTab.id === 'inventory'}>
        {pathKey === '/manufacturing/inventory/wip-valuation' ? (
          <WIPValuationReport />
        ) : (
          <InventoryReport onNavigate={navigateV2} />
        )}
      </Panel>

      <Panel active={activeTab.id === 'boms'}>
        {pathKey === '/manufacturing/boms' ? (
          <BOMList onNavigate={navigateV2} />
        ) : (
          <BOMEditor
            onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['boms'] }); navigate('/manufacturing/boms'); }}
            onCancel={() => navigate('/manufacturing/boms')}
          />
        )}
      </Panel>

      <Panel active={activeTab.id === 'schedules'}>
        {pathKey === '/manufacturing/schedules' ? (
          <ProductionScheduleList onNavigate={navigateV2} />
        ) : (
          <ProductionScheduleEditor
            onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['production-schedules'] }); navigate('/manufacturing/schedules'); }}
            onCancel={() => navigate('/manufacturing/schedules')}
          />
        )}
      </Panel>

      <Panel active={activeTab.id === 'job-cards'}>
        {pathKey === '/manufacturing/job-cards' ? (
          <JobCardList onNavigate={navigateV2} />
        ) : pathKey === '/manufacturing/job-cards/create' ? (
          <JobCardCreate
            onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['job-cards'] }); navigate('/manufacturing/job-cards'); }}
            onCancel={() => navigate('/manufacturing/job-cards')}
          />
        ) : (
          <JobCardDetail jobCardId={pathKey.split('/manufacturing/job-cards/')[1]} onNavigate={navigateV2} />
        )}
      </Panel>

      <Panel active={activeTab.id === 'production'}>
        <ProductionEntryForm onNavigate={navigateV2} />
      </Panel>

      <Panel active={activeTab.id === 'plans'}>
        {pathKey === '/manufacturing/plans' ? (
          <ProductionPlanList onNavigate={navigateV2} />
        ) : pathKey === '/manufacturing/plans/create' ? (
          <ProductionPlanCreate
            onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['production-plans'] }); navigate('/manufacturing/plans'); }}
            onCancel={() => navigate('/manufacturing/plans')}
          />
        ) : pathKey === '/manufacturing/work-centers' ? (
          <WorkCenterList
            onCancel={() => navigate('/manufacturing/plans')}
          />
        ) : (
          <ProductionPlanDetail
            planId={pathKey.split('/manufacturing/plans/')[1]}
            onCancel={() => navigate('/manufacturing/plans')}
          />
        )}
      </Panel>

      <Panel active={activeTab.id === 'dispatch'}>
        {pathKey === '/manufacturing/dispatch' ? (
          <DispatchList onNavigate={navigateV2} />
        ) : pathKey === '/manufacturing/dispatch/create' ? (
          <DispatchCreate
            onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['dispatch-orders'] }); navigate('/manufacturing/dispatch'); }}
            onCancel={() => navigate('/manufacturing/dispatch')}
          />
        ) : (
          <DispatchDetail dispatchOrderId={pathKey.split('/manufacturing/dispatch/')[1]} onNavigate={navigateV2} />
        )}
      </Panel>

      <Panel active={activeTab.id === 'stores'}>
        {pathKey === '/manufacturing/stores' ? (
          <StoresDashboard onNavigate={navigateV2} />
        ) : pathKey === '/manufacturing/stores/grn/create' ? (
          <GRNCreate
            onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['goods-receipt-notes'] }); navigate('/manufacturing/stores'); }}
            onCancel={() => navigate('/manufacturing/stores')}
          />
        ) : pathKey.startsWith('/manufacturing/stores/grn/') ? (
          <GRNDetail
            grnId={pathKey.split('/manufacturing/stores/grn/')[1]}
            onCancel={() => navigate('/manufacturing/stores')}
          />
        ) : (
          <RequisitionDetail
            requisitionId={pathKey.split('/manufacturing/stores/requisitions/')[1]}
            onCancel={() => navigate('/manufacturing/stores')}
          />
        )}
      </Panel>

      <Panel active={activeTab.id === 'qc'}>
        {pathKey === '/manufacturing/qc' ? (
          <QCInspectionList onNavigate={navigateV2} />
        ) : pathKey === '/manufacturing/qc/create' ? (
          <QCInspectionCreate
            onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['qc-inspections'] }); navigate('/manufacturing/qc'); }}
            onCancel={() => navigate('/manufacturing/qc')}
          />
        ) : pathKey === '/manufacturing/qc/parameters' ? (
          <QCParameters
            onCancel={() => navigate('/manufacturing/qc')}
          />
        ) : pathKey === '/manufacturing/qc/ipqc' ? (
          <IPQCDashboard onNavigate={navigateV2} />
        ) : pathKey === '/manufacturing/qc/ipqc/checkpoints' ? (
          <IPQCCheckpointConfig
            onCancel={() => navigate('/manufacturing/qc/ipqc')}
          />
        ) : (
          <QCInspectionDetail
            inspectionId={pathKey.split('/manufacturing/qc/')[1]}
            onCancel={() => navigate('/manufacturing/qc')}
          />
        )}
      </Panel>

      <Panel active={activeTab.id === 'activity'}>
        <ActivityLog onNavigate={navigateV2} />
      </Panel>

      <Panel active={activeTab.id === 'settings'}>
        {pathKey === '/manufacturing/custom-units' ? (
          <CustomUnits onNavigate={navigateV2} />
        ) : (
          <CustomFields onNavigate={navigateV2} />
        )}
      </Panel>
      </div>
    </div>
  );
}
