import { useLocation } from 'react-router-dom';
import AdminGuard from './guard/AdminGuard';
import AdminLayout from './layout/AdminLayout';
import Overview from './pages/Overview';
import Organizations from './pages/Organizations';
import Plans from './pages/Plans';
import Users from './pages/Users';
import Placeholder from './pages/Placeholder';

export default function AdminShell() {
  const location = useLocation();
  const path = (location.pathname || '/admin').split('?')[0];

  let page: React.ReactNode;
  switch (path) {
    case '/admin':
    case '/admin/':
      page = <Overview />;
      break;
    case '/admin/organizations':
      page = <Organizations />;
      break;
    case '/admin/users':
      page = <Users />;
      break;
    case '/admin/plans':
      page = <Plans />;
      break;
    case '/admin/modules':
      page = <Placeholder title="Modules" />;
      break;
    case '/admin/grants':
      page = <Placeholder title="Module Grants" />;
      break;
    case '/admin/payments':
      page = <Placeholder title="Payments" />;
      break;
    case '/admin/reminders':
      page = <Placeholder title="Reminders" />;
      break;
    case '/admin/security':
      page = <Placeholder title="Security" />;
      break;
    default:
      if (path.startsWith('/admin/organizations/')) {
        page = <Placeholder title="Organization detail" />;
      } else {
        page = <Placeholder title="Not found" />;
      }
  }

  return (
    <AdminGuard>
      <AdminLayout>{page}</AdminLayout>
    </AdminGuard>
  );
}
