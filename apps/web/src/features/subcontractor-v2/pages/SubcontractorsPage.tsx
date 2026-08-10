import { DashboardView } from '../components/Dashboard/DashboardView';
import { SubcontractorView } from '../components/Details/SubcontractorView';
import { SubcontractorEdit } from '../components/Details/SubcontractorEdit';
import { WorkOrdersPage } from '../components/WorkOrders/WorkOrdersPage';
import { SubcontractorWorkOrderCreate } from '../components/WorkOrders/SubcontractorWorkOrderCreate';
import { WorkOrderDetailView } from '../components/WorkOrders/WorkOrderDetailView';
import { AttendancePage } from '../components/Attendance/AttendancePage';
import { PaymentsPage } from '../components/Payments/PaymentsPage';
import { DocumentsTab } from '../components/Documents/DocumentsTab';
import { MeasurementSheetWrapper } from '../../../pages/MeasurementSheetWrapper';

interface SubcontractorsPageProps {
  onNavigate: (path: string) => void;
}

/**
 * Extract path segments after a given prefix.
 * E.g. extractSegments('/subcontractors-v2/workorders/abc123', '/subcontractors-v2/workorders')
 * returns ['abc123']
 */
function extractSegments(pathname: string, prefix: string): string[] {
  if (!pathname.startsWith(prefix)) return [];
  const rest = pathname.slice(prefix.length);
  if (!rest || rest === '/') return [];
  return rest.split('/').filter(Boolean);
}

export function SubcontractorsPage({ onNavigate }: SubcontractorsPageProps) {
  const currentPath = window.location.pathname;

  // ── Dynamic deep-link routes ───────────────────────────────────────────────
  // /subcontractors-v2/workorders/:id/create-measurement
  if (currentPath.startsWith('/subcontractors-v2/workorders/')) {
    const segments = extractSegments(currentPath, '/subcontractors-v2/workorders');

    if (segments.length === 2 && segments[1] === 'create-measurement') {
      const workOrderId = segments[0];
      return (
        <MeasurementSheetWrapper
          workOrderId={workOrderId}
          onBack={() => onNavigate(`/subcontractors-v2/workorders/${workOrderId}`)}
          onSuccess={() => onNavigate(`/subcontractors-v2/workorders/${workOrderId}`)}
        />
      );
    }

    // /subcontractors-v2/workorders/:id
    if (segments.length === 1) {
      const workOrderId = segments[0];
      return <WorkOrderDetailView workOrderId={workOrderId} onNavigate={onNavigate} />;
    }
  }

  // ── Static routes ──────────────────────────────────────────────────────────
  switch (currentPath) {
    case '/subcontractors-v2':
      return <DashboardView onNavigate={onNavigate} />;

    case '/subcontractors-v2/view':
      return <SubcontractorView onNavigate={onNavigate} />;

    case '/subcontractors-v2/new':
    case '/subcontractors-v2/edit':
      return <SubcontractorEdit onNavigate={onNavigate} />;

    case '/subcontractors-v2/workorders':
      return <WorkOrdersPage onNavigate={onNavigate} />;

    case '/subcontractors-v2/workorders/create':
      return <SubcontractorWorkOrderCreate onNavigate={onNavigate} />;

    case '/subcontractors-v2/attendance':
      return <AttendancePage onNavigate={onNavigate} />;

    case '/subcontractors-v2/payments':
      return <PaymentsPage onNavigate={onNavigate} />;

    case '/subcontractors-v2/documents':
      return <DocumentsTab onNavigate={onNavigate} />;

    default:
      return <DashboardView onNavigate={onNavigate} />;
  }
}
export default SubcontractorsPage;
