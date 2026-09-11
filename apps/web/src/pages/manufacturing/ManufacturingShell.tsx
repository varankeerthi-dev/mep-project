import { useMemo, useCallback, lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { NestedSubTabs, type NestedSubTabItem } from '../../components/ui/NestedSubTabs';
import { PageSkeleton } from '../../components/ui/skeleton';
import {
  LayoutDashboard,
  Boxes,
  Cpu,
  Layers,
  FileSpreadsheet,
  Calendar,
  ClipboardList,
  Factory,
  GitBranch,
  Truck,
  Warehouse,
  ShieldCheck,
  History,
  Settings,
} from 'lucide-react';

// ── Phase 3: Code-split all sub-page components via React.lazy ──────────────
const ManufacturingDashboard = lazy(() => import('./ManufacturingDashboard'));
const InventoryReport        = lazy(() => import('./InventoryReport'));
const BOMList                = lazy(() => import('./BOMList'));
const BOMEditor              = lazy(() => import('./BOMEditor'));
const ProductionScheduleList = lazy(() => import('./ProductionScheduleList'));
const ProductionScheduleEditor = lazy(() => import('./ProductionScheduleEditor'));
const JobCardList            = lazy(() => import('./JobCardList'));
const JobCardCreate          = lazy(() => import('./JobCardCreate'));
const JobCardDetail          = lazy(() => import('./JobCardDetail'));
const ProductionEntryForm    = lazy(() => import('./ProductionEntryForm'));
const CustomUnits            = lazy(() => import('./CustomUnits'));
const CustomFields           = lazy(() => import('./CustomFields'));
const ActivityLog            = lazy(() => import('./ActivityLog'));

const DispatchList           = lazy(() => import('./dispatch/DispatchList'));
const DispatchCreate         = lazy(() => import('./dispatch/DispatchCreate'));
const DispatchDetail         = lazy(() => import('./dispatch/DispatchDetail'));
const StoresDashboard        = lazy(() => import('./stores/StoresDashboard'));
const RequisitionDetail      = lazy(() => import('./stores/RequisitionDetail'));
const GRNCreate              = lazy(() => import('./stores/GRNCreate'));
const GRNDetail              = lazy(() => import('./stores/GRNDetail'));
const QCInspectionList       = lazy(() => import('./qc/QCInspectionList'));
const QCInspectionCreate     = lazy(() => import('./qc/QCInspectionCreate'));
const QCInspectionDetail     = lazy(() => import('./qc/QCInspectionDetail'));
const QCParameters           = lazy(() => import('./qc/QCParameters'));
const ProductionPlanList     = lazy(() => import('./plans/ProductionPlanList'));
const ProductionPlanCreate   = lazy(() => import('./plans/ProductionPlanCreate'));
const ProductionPlanDetail   = lazy(() => import('./plans/ProductionPlanDetail'));
const WorkCenterList         = lazy(() => import('./work-centers/WorkCenterList'));
const IPQCDashboard          = lazy(() => import('./qc/IPQCDashboard'));
const IPQCCheckpointConfig   = lazy(() => import('./qc/IPQCCheckpointConfig'));
const WIPValuationReport     = lazy(() => import('./inventory/WIPValuationReport'));

const MachineBoardPage       = lazy(() => import('./machine-board/MachineBoardPage'));
const MouldList              = lazy(() => import('./MouldList'));

type Tab = NestedSubTabItem & {
  matchPrefix: string;
};

const TABS: Tab[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/manufacturing', matchPrefix: '/manufacturing/dashboard', icon: <LayoutDashboard size={15} /> },
  { id: 'inventory', label: 'Inventory', path: '/manufacturing/inventory', matchPrefix: '/manufacturing/inventory', icon: <Boxes size={15} /> },
  { id: 'machines', label: 'Machine Board', path: '/manufacturing/machines', matchPrefix: '/manufacturing/machines', icon: <Cpu size={15} /> },
  { id: 'moulds', label: 'Moulds', path: '/manufacturing/moulds', matchPrefix: '/manufacturing/moulds', icon: <Layers size={15} /> },
  { id: 'boms', label: 'BOMs', path: '/manufacturing/boms', matchPrefix: '/manufacturing/boms', icon: <FileSpreadsheet size={15} /> },
  { id: 'schedules', label: 'Schedules', path: '/manufacturing/schedules', matchPrefix: '/manufacturing/schedules', icon: <Calendar size={15} /> },
  { id: 'job-cards', label: 'Job Cards', path: '/manufacturing/job-cards', matchPrefix: '/manufacturing/job-cards', icon: <ClipboardList size={15} /> },
  { id: 'production', label: 'Production', path: '/manufacturing/production', matchPrefix: '/manufacturing/production', icon: <Factory size={15} /> },
  { id: 'plans', label: 'Planning (MRP)', path: '/manufacturing/plans', matchPrefix: '/manufacturing/plans', icon: <GitBranch size={15} /> },
  { id: 'dispatch', label: 'Dispatch', path: '/manufacturing/dispatch', matchPrefix: '/manufacturing/dispatch', icon: <Truck size={15} /> },
  { id: 'stores', label: 'Stores Console', path: '/manufacturing/stores', matchPrefix: '/manufacturing/stores', icon: <Warehouse size={15} /> },
  { id: 'qc', label: 'QC Inspections', path: '/manufacturing/qc', matchPrefix: '/manufacturing/qc', icon: <ShieldCheck size={15} /> },
  { id: 'activity', label: 'Activity Log', path: '/manufacturing/activity-log', matchPrefix: '/manufacturing/activity-log', icon: <History size={15} /> },
  { id: 'settings', label: 'Settings', path: '/manufacturing/custom-units', matchPrefix: '/manufacturing/custom-units', icon: <Settings size={15} /> },
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

export default function ManufacturingShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathKey = location.pathname;
  const queryClient = useQueryClient();

  const activeTab = useMemo(() => {
    if (pathKey === '/manufacturing/dashboard') return TABS[0];
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

  // ── Phase 2: Conditional Mounting ─────────────────────────────────────
  // Only the active tab's component tree mounts (and therefore fetches data).
  // Previously all 14 panels mounted simultaneously with display:none.
  // Each branch is wrapped in <Suspense> so lazy chunks load with a skeleton.

  return (
    <div className="min-h-screen bg-[#f8f9fb] font-['Inter']">
      <div className="w-full px-4 pt-3">
        <NestedSubTabs tabs={TABS} activeTabId={activeTab.id} twoRows={true} className="mb-4 rounded-[8px] border border-[#E0E0E0] overflow-hidden shadow-xs" />

      {activeTab.id === 'dashboard' && (
        <Suspense fallback={<PageSkeleton variant="page" />}>
          <ManufacturingDashboard onNavigate={navigateV2} />
        </Suspense>
      )}

      {activeTab.id === 'machines' && (
        <Suspense fallback={<PageSkeleton variant="page" />}>
          <MachineBoardPage onNavigate={navigateV2} />
        </Suspense>
      )}

      {activeTab.id === 'moulds' && (
        <Suspense fallback={<PageSkeleton variant="table" />}>
          <MouldList onNavigate={navigateV2} />
        </Suspense>
      )}

      {activeTab.id === 'inventory' && (
        <Suspense fallback={<PageSkeleton variant="table" />}>
          {pathKey === '/manufacturing/inventory/wip-valuation' ? (
            <WIPValuationReport />
          ) : (
            <InventoryReport onNavigate={navigateV2} />
          )}
        </Suspense>
      )}

      {activeTab.id === 'boms' && (
        <Suspense fallback={<PageSkeleton variant="table" />}>
          {pathKey === '/manufacturing/boms' ? (
            <BOMList onNavigate={navigateV2} />
          ) : (
            <BOMEditor
              onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['boms'] }); navigate('/manufacturing/boms'); }}
              onCancel={() => navigate('/manufacturing/boms')}
            />
          )}
        </Suspense>
      )}

      {activeTab.id === 'schedules' && (
        <Suspense fallback={<PageSkeleton variant="table" />}>
          {pathKey === '/manufacturing/schedules' ? (
            <ProductionScheduleList onNavigate={navigateV2} />
          ) : (
            <ProductionScheduleEditor
              onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['production-schedules'] }); navigate('/manufacturing/schedules'); }}
              onCancel={() => navigate('/manufacturing/schedules')}
            />
          )}
        </Suspense>
      )}

      {activeTab.id === 'job-cards' && (
        <Suspense fallback={<PageSkeleton variant="table" />}>
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
        </Suspense>
      )}

      {activeTab.id === 'production' && (
        <Suspense fallback={<PageSkeleton variant="detail" />}>
          <ProductionEntryForm onNavigate={navigateV2} />
        </Suspense>
      )}

      {activeTab.id === 'plans' && (
        <Suspense fallback={<PageSkeleton variant="table" />}>
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
        </Suspense>
      )}

      {activeTab.id === 'dispatch' && (
        <Suspense fallback={<PageSkeleton variant="table" />}>
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
        </Suspense>
      )}

      {activeTab.id === 'stores' && (
        <Suspense fallback={<PageSkeleton variant="table" />}>
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
        </Suspense>
      )}

      {activeTab.id === 'qc' && (
        <Suspense fallback={<PageSkeleton variant="table" />}>
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
        </Suspense>
      )}

      {activeTab.id === 'activity' && (
        <Suspense fallback={<PageSkeleton variant="list" />}>
          <ActivityLog onNavigate={navigateV2} />
        </Suspense>
      )}

      {activeTab.id === 'settings' && (
        <Suspense fallback={<PageSkeleton variant="table" />}>
          {pathKey === '/manufacturing/custom-units' ? (
            <CustomUnits onNavigate={navigateV2} />
          ) : (
            <CustomFields onNavigate={navigateV2} />
          )}
        </Suspense>
      )}
      </div>
    </div>
  );
}
