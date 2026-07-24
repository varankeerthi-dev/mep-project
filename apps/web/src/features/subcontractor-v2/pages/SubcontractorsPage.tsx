import { DashboardView } from '../components/Dashboard/DashboardView';
import { SubcontractorView } from '../components/Details/SubcontractorView';
import { SubcontractorEdit } from '../components/Details/SubcontractorEdit';
import { WorkOrdersPage } from '../components/WorkOrders/WorkOrdersPage';
import { SubcontractorWorkOrderCreate } from '../components/WorkOrders/SubcontractorWorkOrderCreate';
import { AttendancePage } from '../components/Attendance/AttendancePage';
import { PaymentsPage } from '../components/Payments/PaymentsPage';
import { DocumentsTab } from '../components/Documents/DocumentsTab';

interface SubcontractorsPageProps {
  onNavigate: (path: string) => void;
}

export function SubcontractorsPage({ onNavigate }: SubcontractorsPageProps) {
  const currentPath = window.location.pathname;

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
