import { lazy } from 'react';
import type { RouteConfig } from '../../app/routing/types';

const Dashboard = lazy(() => import('../../pages/Dashboard'));
const Operations = lazy(() => import('../../pages/operations/Operations'));
const ProjectTasks = lazy(() => import('../../pages/ProjectTasks'));

export const coreRoutes: RouteConfig[] = [
  {
    id: 'dashboard',
    path: '/dashboard',
    component: Dashboard,
    module: 'core',
    title: 'Dashboard',
    showInSidebar: true,
    searchable: true,
    breadcrumb: true,
    order: 1,
  },
  {
    id: 'operations',
    path: '/operations',
    component: Operations,
    module: 'core',
    title: 'Operations',
    showInSidebar: true,
    searchable: true,
    breadcrumb: true,
    order: 2,
  },
  {
    id: 'project-tasks',
    path: '/projects/daily-updates',
    component: ProjectTasks,
    module: 'core',
    title: 'Daily Updates',
    showInSidebar: false,
    searchable: true,
    breadcrumb: true,
  },
];
